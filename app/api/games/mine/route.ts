import { handle, ok } from "@/lib/api";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { expireStaleRooms } from "@/lib/server/rooms";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  const user = await requireUser();

  // Lazy-expire stale WAITING rooms so CLOSED/COMPLETED rooms never surface
  // in "your matches" (even when the underlying game row is still WAITING).
  await expireStaleRooms();

  const games = await prisma.game.findMany({
    where: {
      players: { some: { userId: user.id } },
      status: { in: ["WAITING", "PLAYING"] },
      // Rooms that are CLOSED/COMPLETED (or otherwise not alive) must not appear;
      // games without a room (AI practice) always stay visible.
      OR: [{ room: null }, { room: { status: { in: ["WAITING", "PLAYING"] } } }],
    },
    include: {
      room: { select: { roomCode: true, roomName: true, maxPlayers: true } },
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
      roomName: g.room?.roomName ?? null,
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
