import { handle, ok } from "@/lib/api";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  const user = await requireUser();

  const games = await prisma.game.findMany({
    where: {
      players: { some: { userId: user.id } },
      status: { in: ["WAITING", "PLAYING"] },
    },
    include: {
      room: { select: { roomCode: true, maxPlayers: true } },
      players: {
        include: { user: { select: { username: true } } },
        orderBy: { playerNumber: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  return ok({
    games: games.map((g) => ({
      id: g.id,
      type: g.type,
      gameMode: g.gameMode,
      aiDifficulty: g.aiDifficulty,
      status: g.status,
      roomCode: g.room?.roomCode ?? null,
      maxPlayers: g.room?.maxPlayers ?? 2,
      playersCount: g.players.length,
      createdAt: g.createdAt.toISOString(),
      seats: g.players.map((p) => ({
        username: p.user?.username ?? p.botName ?? "AI",
        color: p.color,
      })),
    })),
  });
});
