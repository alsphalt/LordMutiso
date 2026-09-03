import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { badRequest } from "@/lib/api";
import { ludoSeatAssignment, seatAssignment, ludoColorsFor } from "@/lib/games/types";
import type { ColorName, GameTypeName } from "@/lib/games/types";
import { initialEngineState, runAiTurns } from "@/lib/server/ai-run";

export interface AiCreateInput {
  type: GameTypeName;
  aiCount: number; // LUDO only: 1..3
  difficulty: "EASY" | "MEDIUM" | "HARD";
  color: ColorName; // human color choice
}

const BOT_NAMES = ["Nova", "Pulse", "Zeta", "Echo"];

/** All colors offered for a Ludo seat count (in seat order). */
export function ludoColorOptions(totalSeats: number): ColorName[] {
  return ludoColorsFor(totalSeats);
}

export async function createAiGame(userId: string, input: AiCreateInput): Promise<string> {
  const isLudo = input.type === "LUDO";
  const total = isLudo ? input.aiCount + 1 : 2;

  // resolve the human seat index by chosen colour
  let humanIndex: number;
  if (isLudo) {
    const colors = ludoColorsFor(total);
    humanIndex = colors.indexOf(input.color);
    if (humanIndex === -1) throw badRequest("That colour is not available for this match size");
  } else {
    humanIndex = input.color === "WHITE" ? 0 : 1;
  }

  const assignments = Array.from({ length: total }, (_, i) => (isLudo ? ludoSeatAssignment(total, i) : seatAssignment(input.type, total, i)));
  const playerNumbers = assignments.map((a) => a.playerNumber);

  return await prisma.$transaction(async (tx) => {
    const game = await tx.game.create({
      data: {
        type: input.type,
        gameMode: "AI",
        aiDifficulty: input.difficulty,
        status: "PLAYING",
        createdBy: userId,
        gameState: {},
        startedAt: new Date(),
        currentTurn: Math.min(...playerNumbers),
      },
    });

    const state = initialEngineState(input.type, playerNumbers);
    await tx.game.update({ where: { id: game.id }, data: { gameState: state as unknown as Prisma.InputJsonValue } });

    let botIdx = 0;
    for (let i = 0; i < total; i++) {
      const isHuman = i === humanIndex;
      const botName = isHuman ? null : `${BOT_NAMES[botIdx++ % BOT_NAMES.length]} (${input.difficulty})`;
      await tx.gamePlayer.create({
        data: {
          gameId: game.id,
          userId: isHuman ? userId : null,
          isAi: !isHuman,
          botName,
          playerNumber: assignments[i].playerNumber,
          color: assignments[i].color,
        },
      });
    }

    // AI opens? play its turn(s) immediately so the human never waits.
    const firstSeatPns = playerNumbers.slice().sort((a, b) => a - b);
    const firstSeat = await tx.gamePlayer.findFirst({
      where: { gameId: game.id, playerNumber: firstSeatPns[0] },
    });
    if (firstSeat?.isAi) {
      await runAiTurns(tx, game.id);
    }

    return game.id;
  });
}
