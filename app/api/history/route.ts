import { handle, ok } from "@/lib/api";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export const GET = handle(async (req) => {
  const user = await requireUser();
  const { searchParams } = new URL(req.url);
  const before = searchParams.get("before");
  const gameType = searchParams.get("game");
  const limit = Math.min(Number(searchParams.get("limit") || 30), 100);

  const games = await prisma.game.findMany({
    where: {
      players: { some: { userId: user.id } },
      ...(gameType ? { type: gameType as any } : {}),
      ...(before ? { createdAt: { lt: new Date(before) } } : {}),
    },
    include: {
      players: { include: { user: { select: { username: true } } } },
      winner: { select: { username: true } },
      room: { select: { roomCode: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
  });

  const hasMore = games.length > limit;
  const page = hasMore ? games.slice(0, limit) : games;
  const nextCursor = hasMore ? page[page.length - 1].createdAt.toISOString() : null;

  return ok({
    games: page.map((g) => {
      const mySeat = g.players.find((p) => p.userId === user.id);
      const isDraw = g.status === "DRAW";
      const wonByMe =
        g.winnerId === user.id || (mySeat !== undefined && g.winnerPlayerNumber === mySeat.playerNumber);
      const result = isDraw ? "draw" : g.winnerId || g.winnerPlayerNumber ? (wonByMe ? "win" : "loss") : null;
      
      const durationMs = g.startedAt && g.endedAt 
        ? g.endedAt.getTime() - g.startedAt.getTime() 
        : 0;

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
        opponentNames: g.players.filter(p => p.userId !== user.id).map(p => p.user?.username ?? p.botName ?? "AI"),
        createdAt: g.createdAt.toISOString(),
        startedAt: g.startedAt?.toISOString() ?? null,
        endedAt: g.endedAt?.toISOString() ?? null,
        durationMs,
      };
    }),
    nextCursor,
  });
});
