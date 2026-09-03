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
      room: { select: { roomCode: true } },
      players: {
        include: { user: { select: { username: true } } },
        orderBy: { playerNumber: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return ok({
    games: games.map((g) => ({
      id: g.id,
      type: g.type,
      status: g.status,
      roomCode: g.room?.roomCode ?? null,
      createdAt: g.createdAt.toISOString(),
      seats: g.players.map((p) => p.user.username),
    })),
  });
});
