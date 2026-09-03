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

/**
 * Apply final statistics for a finished game. Must be called inside a
 * transaction after the game has transitioned exactly once.
 *
 * ONLINE games update the competitive counters + Elo rating.
 * AI practice games only update `aiGames/aiWins/aiDraws` — they never touch
 * the competitive rating or leaderboard counters.
 */
export async function applyFinishedStats(
  tx: Prisma.TransactionClient,
  opts: {
    participants: Array<{ userId: string; playerNumber: number }>;
    winnerUserId: string | null;
    winnerPlayerNumber: number | null;
    gameType: "LUDO" | "CHESS" | "CHECKERS";
    gameMode: "ONLINE" | "AI";
  }
): Promise<void> {
  const { participants, winnerUserId, winnerPlayerNumber, gameType, gameMode } = opts;

  if (gameMode === "AI") {
    for (const p of participants) {
      const won = winnerUserId !== null && winnerUserId === p.userId;
      const draw = winnerUserId === null && winnerPlayerNumber === null;
      const data: Prisma.UserStatisticsUpdateInput = { aiGames: { increment: 1 } };
      if (won) data.aiWins = { increment: 1 };
      if (draw) data.aiDraws = { increment: 1 };
      await tx.userStatistics.upsert({
        where: { userId: p.userId },
        update: data,
        create: { userId: p.userId, aiGames: 1, aiWins: won ? 1 : 0, aiDraws: draw ? 1 : 0 },
      });
    }
    return;
  }

  // ---- ONLINE (competitive) ----
  await ensureStatsRows(tx, participants.map((p) => p.userId));
  const rows = await tx.userStatistics.findMany({ where: { userId: { in: participants.map((p) => p.userId) } } });
  const map = new Map(rows.map((s) => [s.userId, s]));
  const isDraw = !winnerUserId;

  for (const p of participants) {
    const row = map.get(p.userId)!;
    const won = winnerUserId === p.userId;
    const lost = !isDraw && winnerUserId !== null && winnerUserId !== p.userId;
    const deltas: Prisma.UserStatisticsUpdateInput = { gamesPlayed: { increment: 1 } };
    if (won) {
      deltas.gamesWon = { increment: 1 };
      if (gameType === "LUDO") deltas.ludoWins = { increment: 1 };
      if (gameType === "CHESS") deltas.chessWins = { increment: 1 };
      if (gameType === "CHECKERS") deltas.checkersWins = { increment: 1 };
    }
    if (lost) deltas.gamesLost = { increment: 1 };
    if (isDraw) deltas.draws = { increment: 1 };
    await tx.userStatistics.update({ where: { userId: p.userId }, data: deltas });
  }

  // Elo rating
  const K = 32;
  if (isDraw && participants.length === 2) {
    const [a, b] = participants;
    const ra = map.get(a.userId)!.rating;
    const rb = map.get(b.userId)!.rating;
    const ea = 1 / (1 + Math.pow(10, (rb - ra) / 400));
    await tx.userStatistics.update({ where: { userId: a.userId }, data: { rating: Math.round(ra + K * (0.5 - ea)) } });
    await tx.userStatistics.update({ where: { userId: b.userId }, data: { rating: Math.round(rb + K * (0.5 - (1 - ea))) } });
  } else if (winnerUserId) {
    for (const opp of participants) {
      if (opp.userId === winnerUserId) continue;
      const rw = map.get(winnerUserId)!.rating;
      const ro = map.get(opp.userId)!.rating;
      const ea = 1 / (1 + Math.pow(10, (ro - rw) / 400));
      await tx.userStatistics.update({ where: { userId: winnerUserId }, data: { rating: Math.round(rw + K * (1 - ea)) } });
      await tx.userStatistics.update({ where: { userId: opp.userId }, data: { rating: Math.round(ro + K * (0 - (1 - ea))) } });
    }
  }
}

async function ensureStatsRows(tx: Prisma.TransactionClient, userIds: string[]) {
  for (const uid of userIds) {
    await tx.userStatistics.upsert({ where: { userId: uid }, update: {}, create: { userId: uid } });
  }
}
