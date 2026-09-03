import { handle, readBody, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { joinRoomSchema } from "@/lib/validation/schemas";
import { joinRoom } from "@/lib/server/rooms";

export const dynamic = "force-dynamic";

export const POST = handle(async (req) => {
  const user = await requireUser();
  const body = await readBody(req);
  const { roomCode } = joinRoomSchema.parse(body);

  const { room } = await joinRoom(roomCode, user.id);

  // Return RoomRow
  return ok({
    room: {
      id: room.id,
      gameId: room.gameId,
      roomCode: room.roomCode,
      type: room.game.type,
      status: room.status,
      maxPlayers: room.maxPlayers,
      players: room.game.players.map((p) => ({
        userId: p.userId,
        username: p.user.username,
        image: p.user.image,
        playerNumber: p.playerNumber,
        color: p.color,
      })),
      createdAt: room.createdAt.toISOString(),
    },
  });
});
