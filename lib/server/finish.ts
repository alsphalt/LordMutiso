import type { Prisma } from "@prisma/client";
import { applyFinishedStats } from "@/lib/stats";
import { notifyAll } from "@/lib/notifications";

export interface FinishOptions {
  status: "FINISHED" | "DRAW" | "CANCELLED";
  winnerId: string | null; // winner's user id (null for AI winners / draws)
  winnerPlayerNumber: number | null; // winning seat number (works for AI seats)
}

/**
 * Shared atomic finish flow for games.
 * 1. Atomically transitions the game (guard against double-finish).
 * 2. Applies statistics — ONLINE games update competitive stats + Elo,
 *    AI practice games only update the AI counters.
 * 3. Notifies the human players.
 */
export async function finishGame(
  tx: Prisma.TransactionClient,
  gameId: string,
  opts: FinishOptions
): Promise<boolean> {
  const transitioned = await tx.game.updateMany({
    where: { id: gameId, status: { in: ["WAITING", "PLAYING"] } },
    data: {
      status: opts.status,
      winnerId: opts.winnerId,
      winnerPlayerNumber: opts.winnerPlayerNumber,
      endedAt: new Date(),
      currentTurn: null,
    },
  });
  if (transitioned.count === 0) return false;

  // A finished game can never leave its room in a discoverable/active state.
  // Flip the room to COMPLETED so active lists, counts and "your matches"
  // (which require room status WAITING/PLAYING) all exclude it.
  await tx.gameRoom.updateMany({
    where: { gameId, status: { in: ["WAITING", "PLAYING"] } },
    data: { status: "COMPLETED" },
  });

  const game = await tx.game.findUnique({
    where: { id: gameId },
    include: { players: true },
  });
  if (!game) return false;

  const started = game.startedAt !== null;
  if (started && (opts.status === "FINISHED" || opts.status === "DRAW")) {
    const humans = game.players.filter((p) => p.userId !== null);
    if (humans.length > 0) {
      await applyFinishedStats(tx, {
        participants: humans.map((p) => ({ userId: p.userId!, playerNumber: p.playerNumber })),
        winnerUserId: opts.winnerId,
        winnerPlayerNumber: opts.winnerPlayerNumber,
        gameType: game.type,
        gameMode: game.gameMode,
      });
    }
  }

  // Notify human players only.
  const humans = game.players.filter((p) => p.userId !== null);
  if (humans.length > 0) {
    const title = opts.status === "DRAW" ? "Game drawn" : "Game finished";
    const body =
      opts.status === "DRAW"
        ? "The game ended in a draw."
        : opts.winnerPlayerNumber
          ? `Seat ${opts.winnerPlayerNumber} won the ${game.type} game.`
          : `The ${game.type} game has ended.`;
    await notifyAll(
      humans.map((p) => ({
        userId: p.userId!,
        type: "GAME_ENDED",
        title,
        body,
        gameId: game.id,
      })),
      tx
    );
  }

  return true;
}
