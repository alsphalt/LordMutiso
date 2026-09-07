import { handle, readBody, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { joinRoomSchema } from "@/lib/validation/schemas";
import { joinRoomByCode, toRoomRow, type RoomFull } from "@/lib/server/rooms";

export const dynamic = "force-dynamic";

export const POST = handle(async (req) => {
  const user = await requireUser();
  const body = await readBody(req);
  const { roomCode } = joinRoomSchema.parse(body);

  const { room } = await joinRoomByCode(roomCode, user.id);

  // Return RoomRow
  return ok({ room: toRoomRow(room as RoomFull) });
});
