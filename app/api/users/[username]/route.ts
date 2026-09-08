import { handle, ok, notFound } from "@/lib/api";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export const GET = handle(async (req, { params }) => {
  const username = params?.username;
  if (!username) throw notFound();

  const user = await prisma.user.findUnique({
    where: { username },
    select: { id: true, username: true, image: true, country: true, createdAt: true },
  });

  if (!user) throw notFound("User not found");

  const stats = await prisma.userStatistics.findUnique({
    where: { userId: user.id },
  });

  const recentGames = await prisma.game.findMany({
    where: {
      players: { some: { userId: user.id } },
    },
    include: {
      players: { include: { user: { select: { username: true } } } },
      winner: { select: { username: true } },
      room: { select: { roomCode: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 8,
  });

  const viewer = await getSessionUser();
  const isSelf = viewer?.id === user.id;

  return ok({
    user: {
      id: user.id,
      username: user.username,
      image: user.image,
      country: user.country,
      createdAt: user.createdAt.toISOString(),
    },
    stats: stats ? {
      // competitive (online multiplayer)
      gamesPlayed: stats.gamesPlayed,
      gamesWon: stats.gamesWon,
      gamesLost: stats.gamesLost,
      draws: stats.draws,
      rating: stats.rating,
      ludoWins: stats.ludoWins,
      chessWins: stats.chessWins,
      checkersWins: stats.checkersWins,
      // AI practice
      aiGames: stats.aiGames,
      aiWins: stats.aiWins,
      aiDraws: stats.aiDraws,
    } : null,
    recent: recentGames.map((g) => {
      const mySeat = g.players.find((p) => p.userId === user.id);
      const isDraw = g.status === "DRAW";
      const wonByMe =
        g.winnerId === user.id || (mySeat !== undefined && g.winnerPlayerNumber === mySeat.playerNumber);
      const result = isDraw ? "draw" : g.winnerId || g.winnerPlayerNumber ? (wonByMe ? "win" : "loss") : null;

      const durationMs = g.startedAt && g.endedAt ? g.endedAt.getTime() - g.startedAt.getTime() : 0;

      return {
        id: g.id,
        type: g.type,
        gameMode: g.gameMode,
        aiDifficulty: g.aiDifficulty,
        status: g.status,
        roomCode: g.room?.roomCode ?? null,
        result,
        winnerId: g.winnerId,
        winnerUsername: g.winner?.username ?? null,
        opponentNames: g.players.filter((p) => p.userId !== user.id).map((p) => p.user?.username ?? p.botName ?? "AI"),
        createdAt: g.createdAt.toISOString(),
        startedAt: g.startedAt?.toISOString() ?? null,
        endedAt: g.endedAt?.toISOString() ?? null,
        durationMs,
      };
    }),
    isSelf,
  });
});
