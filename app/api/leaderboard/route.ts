import { handle, ok } from "@/lib/api";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export const GET = handle(async (req) => {
  const { searchParams } = new URL(req.url);
  const game = searchParams.get("game") || "OVERALL";

  const rows = await prisma.userStatistics.findMany({
    include: {
      user: { select: { username: true, image: true } },
    },
    orderBy: [
      { rating: "desc" },
      { gamesWon: "desc" },
    ],
    take: 100,
  });

  return ok({
    rows: rows.map((r) => ({
      userId: r.userId,
      username: r.user.username,
      image: r.user.image,
      rating: r.rating,
      gamesPlayed: r.gamesPlayed,
      gamesWon: r.gamesWon,
      gamesLost: r.gamesLost,
      draws: r.draws,
      ludoWins: r.ludoWins,
      chessWins: r.chessWins,
      checkersWins: r.checkersWins,
    })),
  });
});
