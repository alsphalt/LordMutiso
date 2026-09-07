import type { Prisma, GamePlayer } from "@prisma/client";
import { prisma } from "@/lib/db";
import { randomInt } from "@/lib/utils";
import type { AiDifficulty } from "@/lib/games/ai";
import { chooseChessMove, chooseCheckersMove, chooseLudoMove } from "@/lib/games/ai";
import type { CheckersMove } from "@/lib/games/checkers/engine";
import { createCheckersState, legalCheckersMoves, stepCheckers, resignCheckers } from "@/lib/games/checkers/engine";
import type { LudoState, LudoMove } from "@/lib/games/ludo/engine";
import { createLudoState, rollLudo, moveLudoToken, legalLudoMoves } from "@/lib/games/ludo/engine";
import type { ChessState } from "@/lib/games/chess/engine";
import { createChessState, stepChess, chessTurnSeat } from "@/lib/games/chess/engine";
import { finishGame } from "@/lib/server/finish";
import { randomDicePose } from "@/lib/games/ludo/dice";

/**
 * Drives AI opponents inside an AI-mode game.
 *
 * The game remains 100% server-authoritative: AI rolls use the same dice
 * generator, every move is validated by the same engines and persisted to
 * Neon as normal GameMove rows. This executor simply replaces the "human
 * sends an action" step with a decision made by lib/games/ai.
 */

type SeatLike = GamePlayer;

async function recordMove(tx: Prisma.TransactionClient, gameId: string, playerId: string, moveData: unknown) {
  const n = await tx.gameMove.count({ where: { gameId } });
  await tx.gameMove.create({
    data: { gameId, playerId, moveNumber: n + 1, moveData: moveData as Prisma.InputJsonValue },
  });
}

/** Execute AI turn(s) until the human's turn (or game end). Call inside a transaction. */
export async function runAiTurns(tx: Prisma.TransactionClient, gameId: string, maxUnits = 240): Promise<void> {
  for (let i = 0; i < maxUnits; i++) {
    const game = await tx.game.findUnique({
      where: { id: gameId },
      include: { players: true },
    });
    if (!game || game.status !== "PLAYING" || game.currentTurn === null) return;
    const seat = game.players.find((p) => p.playerNumber === game.currentTurn);
    if (!seat || !seat.isAi) return; // human's turn

    const done = await playAiUnit(tx, gameId);
    if (done) return;
  }
}

async function playAiUnit(tx: Prisma.TransactionClient, gameId: string): Promise<boolean> {
  const game = await tx.game.findUnique({
    where: { id: gameId },
    include: { players: true },
  });
  if (!game || game.status !== "PLAYING" || game.currentTurn === null) return true;
  const seat = game.players.find((p) => p.playerNumber === game.currentTurn);
  if (!seat || !seat.isAi) return true;

  const difficulty: AiDifficulty = (game.aiDifficulty as AiDifficulty | null) ?? "MEDIUM";
  const state = (game.gameState ?? {}) as unknown as Record<string, unknown>;
  const finish = async (opts: { status: "FINISHED" | "DRAW"; winnerPlayerNumber: number | null }) => {
    const winnerSeat = opts.winnerPlayerNumber != null ? game.players.find((p) => p.playerNumber === opts.winnerPlayerNumber) : null;
    await finishGame(tx, gameId, {
      status: opts.status,
      winnerId: winnerSeat?.userId ?? null,
      winnerPlayerNumber: opts.winnerPlayerNumber,
    });
  };

  if (game.type === "LUDO") {
    const s = state as unknown as LudoState;
    let outcome;
    if (s.phase === "ROLL") {
      const die = randomInt(1, 7);
      // Physical dice: give the AI roll an authoritative resting pose (whose
      // visible face matches the roll) so observers replay onto the same spot.
      s.dice = randomDicePose(die);
      const res = rollLudo(s, die);
      await recordMove(tx, gameId, seat.id, {
        kind: "ludo-roll",
        die,
        playerNumber: seat.playerNumber,
        autoPassed: res.autoPassed,
        dice: s.dice ?? null,
      });
    } else {
      const legal = legalMovesOf(s, seat.playerNumber);
      const choice = chooseLudoMove(s, seat.playerNumber, legal, difficulty);
      if (choice === null) {
        // no legal move: clear the die and advance (should not happen, but safe)
        s.die = null;
        s.phase = "ROLL";
      } else {
        const dieUsed = s.die;
        outcome = moveLudoToken(s, choice);
        await recordMove(tx, gameId, seat.id, {
          kind: "ludo-move",
          token: outcome.move.token,
          fromR: outcome.move.fromR,
          toR: outcome.move.toR,
          capture: outcome.captured,
          capturedTokens: outcome.capturedList,
          die: dieUsed,
          playerNumber: seat.playerNumber,
          extraRoll: outcome.extraRoll,
        });
        if (outcome.result.done) {
          await tx.game.update({ where: { id: gameId }, data: { gameState: s as unknown as Prisma.InputJsonValue } });
          await finish({ status: "FINISHED", winnerPlayerNumber: outcome.result.winner });
          return true;
        }
      }
    }
    await tx.game.update({
      where: { id: gameId },
      data: { gameState: JSON.parse(JSON.stringify(s)) as Prisma.InputJsonValue, currentTurn: s.turn },
    });
    return false;
  }

  if (game.type === "CHECKERS") {
    const s = state as unknown as ReturnType<typeof createCheckersState>;
    const legal: CheckersMove[] = legalCheckersMoves(s);
    if (legal.length === 0) {
      // No moves -> AI loses by being stuck.
      await finish({ status: "FINISHED", winnerPlayerNumber: s.turn === 1 ? 2 : 1 });
      return true;
    }
    const mv = chooseCheckersMove(s, legal, difficulty);
    if (!mv) return true;
    const step = stepCheckers(s, mv.from, mv.to);
    await recordMove(tx, gameId, seat.id, {
      kind: "checkers-move",
      from: step.move.from,
      to: step.move.to,
      capture: step.move.capture,
      captureIdx: step.move.captureIdx,
      crowned: step.move.crowned,
      playerNumber: seat.playerNumber,
    });
    if (step.result.done) {
      await tx.game.update({ where: { id: gameId }, data: { gameState: s as unknown as Prisma.InputJsonValue } });
      await finish({
        status: step.result.draw ? "DRAW" : "FINISHED",
        winnerPlayerNumber: step.result.draw ? null : step.result.winner,
      });
      return true;
    }
    await tx.game.update({
      where: { id: gameId },
      data: { gameState: JSON.parse(JSON.stringify(s)) as Prisma.InputJsonValue, currentTurn: s.turn },
    });
    return step.chainContinues ? false : true; // a chain continues within the same AI turn
  }

  // CHESS
  const s = state as unknown as ChessState;
  const mv = chooseChessMove(s.fen, difficulty);
  if (!mv) return true;
  const step = stepChess(s, mv, Date.now());
  await recordMove(tx, gameId, seat.id, {
    kind: "chess-move",
    from: mv.from,
    to: mv.to,
    san: step.san,
    playerNumber: seat.playerNumber,
  });
  if (step.result.done) {
    await tx.game.update({ where: { id: gameId }, data: { gameState: s as unknown as Prisma.InputJsonValue } });
    await finish({
      status: step.result.draw ? "DRAW" : "FINISHED",
      winnerPlayerNumber: step.result.draw ? null : step.result.winner,
    });
    return true;
  }
  await tx.game.update({
    where: { id: gameId },
    data: { gameState: JSON.parse(JSON.stringify(s)) as Prisma.InputJsonValue, currentTurn: chessTurnSeat(s.fen) },
  });
  return true;
}

function legalMovesOf(s: LudoState, _player: number): LudoMove[] {
  return legalLudoMoves(s);
}

/** Initial engine state for a fresh game. */
export function initialEngineState(type: "LUDO" | "CHESS" | "CHECKERS", playerNumbers: number[]): Record<string, unknown> {
  if (type === "LUDO") return createLudoState(playerNumbers) as unknown as Record<string, unknown>;
  if (type === "CHECKERS") return createCheckersState() as unknown as Record<string, unknown>;
  return createChessState() as unknown as Record<string, unknown>;
}
