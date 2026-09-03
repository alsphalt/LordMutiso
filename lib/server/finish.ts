import { Prisma } from "@prisma/client";
import { applyFinishedStats } from "@/lib/stats";
import { notifyAll } from "@/lib/notifications";

/**
 * Shared atomic finish flow for games.
 * Updates the game status, applies rating changes, and notifies players.
 */
export async function finishGame(
  tx: Prisma.TransactionClient,
  gameId: string,
  opts: { winnerId: string | null; status: "FINISHED" | "DRAW" | "CANCELLED" }
): Promise<boolean> {
  // 1. Fetch game details needed for stats and notifications
  const game = await tx.game.findUnique({
    where: { id: gameId },
    include: {
      players: { select: { userId: true, user: { select: { username: true } } } },
    },
  });

  if (!game || (game.status !== "WAITING" && game.status !== "PLAYING")) {
    return false;
  }

  // 2. Atomic update
  const updated = await tx.game.updateMany({
    where: { id: gameId, status: { in: ["WAITING", "PLAYING"] } },
    data: {
      status: opts.status,
      winnerId: opts.winnerId,
      endedAt: new Date(),
      currentTurn: null,
    },
  });

  if (updated.count === 0) return false;

  const participantIds = game.players.map((p) => p.userId);
  const winner = opts.winnerId ? game.players.find((p) => p.userId === opts.winnerId) : null;

  // 3. Stats (only for FINISHED/DRAW if it actually started)
  if ((opts.status === "FINISHED" || opts.status === "DRAW") && game.startedAt) {
    await applyFinishedStats(tx, {
      participantIds,
      winnerId: opts.winnerId,
      gameType: game.type,
    });
  }

  // 4. Notifications
  const body =
    opts.status === "DRAW"
      ? "The game ended in a draw."
      : opts.status === "CANCELLED"
      ? "The game was cancelled."
      : winner
      ? `${winner.user.username} won the game!`
      : "The game finished.";

  await notifyAll(
    participantIds.map((uid) => ({
      userId: uid,
      type: "GAME_ENDED",
      title: "Game finished",
      body,
      gameId: game.id,
    })),
    tx
  );

  return true;
}
