import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

/** Guarantee a statistics row exists (register + seed). */
export async function ensureUserStats(userId: string, tx?: Prisma.TransactionClient): Promise<void> {
  const db = (tx ?? prisma) as typeof prisma;
  await db.userStatistics.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });
}

export interface StatsUpdate {
  userId: string;
  delta: { won?: boolean; lost?: boolean; draw?: boolean; gameType?: "LUDO" | "CHESS" | "CHECKERS" };
}

/**
 * Apply final statistics + rating changes for a finished game.
 * `winnerId` null means a draw. Must be called inside a transaction after
 * the game has transitioned to FINISHED/DRAW exactly once.
 */
export async function applyFinishedStats(
  tx: Prisma.TransactionClient,
  opts: {
    participantIds: string[];
    winnerId: string | null;
    gameType: "LUDO" | "CHESS" | "CHECKERS";
  }
): Promise<void> {
  const { participantIds, winnerId, gameType } = opts;
  const stats = await tx.userStatistics.findMany({
    where: { userId: { in: participantIds } },
  });
  const map = new Map(stats.map((s) => [s.userId, s]));
  const ensured = new Set<string>();

  for (const uid of participantIds) {
    if (!map.has(uid)) {
      await tx.userStatistics.create({ data: { userId: uid } });
      map.set(uid, { userId: uid, rating: 1000 } as (typeof stats)[number]);
      ensured.add(uid);
    }
  }

  const isDraw = !winnerId;
  const winnerRow = winnerId ? map.get(winnerId) : undefined;

  for (const uid of participantIds) {
    const row = map.get(uid)!;
    const won = winnerId === uid;
    const lost = !isDraw && winnerId !== null && winnerId !== uid;
    const deltas: Prisma.UserStatisticsUpdateInput = {
      gamesPlayed: { increment: 1 },
    };
    if (won) {
      deltas.gamesWon = { increment: 1 };
      if (gameType === "LUDO") deltas.ludoWins = { increment: 1 };
      if (gameType === "CHESS") deltas.chessWins = { increment: 1 };
      if (gameType === "CHECKERS") deltas.checkersWins = { increment: 1 };
    }
    if (lost) deltas.gamesLost = { increment: 1 };
    if (isDraw) deltas.draws = { increment: 1 };
    await tx.userStatistics.update({ where: { userId: uid }, data: deltas });
  }

  // Rating: winner/loser pairs (draws handled pairwise too).
  const participants = [...participantIds];
  if (isDraw && participants.length === 2) {
    const [a, b] = participants;
    const ra = map.get(a)!.rating;
    const rb = map.get(b)!.rating;
    const ea = 1 / (1 + Math.pow(10, (rb - ra) / 400));
    const eb = 1 / (1 + Math.pow(10, (ra - rb) / 400));
    const K = 32;
    await tx.userStatistics.update({
      where: { userId: a },
      data: { rating: Math.round(ra + K * (0.5 - ea)) },
    });
    await tx.userStatistics.update({
      where: { userId: b },
      data: { rating: Math.round(rb + K * (0.5 - eb)) },
    });
  } else if (winnerId) {
    const opponents = participants.filter((p) => p !== winnerId);
    for (const opp of opponents) {
      const rw = winnerRow?.rating ?? 1000;
      const ro = map.get(opp)?.rating ?? 1000;
      const ea = 1 / (1 + Math.pow(10, (ro - rw) / 400));
      const eb = 1 / (1 + Math.pow(10, (rw - ro) / 400));
      const K = 32;
      await tx.userStatistics.update({
        where: { userId: winnerId },
        data: { rating: Math.round((winnerRow?.rating ?? 1000) + K * (1 - ea)) },
      });
      await tx.userStatistics.update({
        where: { userId: opp },
        data: { rating: Math.round(ro + K * (0 - eb)) },
      });
    }
  }
}
