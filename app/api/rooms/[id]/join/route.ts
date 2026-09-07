import { handle, ok, badRequest } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { joinRoomByGame, toRoomRow, type RoomFull } from "@/lib/server/rooms";

export const dynamic = "force-dynamic";

/**
 * POST /api/rooms/[id]/join — quick-join a discoverable QUICK room.
 * The [id] segment is the room's gameId (same convention as [id]/start & [id]/leave).
 */
export const POST = handle(async (_req, { params }) => {
  const user = await requireUser();
  const id = params?.id;
  if (!id) throw badRequest("Missing room ID");

  const { room } = await joinRoomByGame(id, user.id);

  return ok({ room: toRoomRow(room as RoomFull) });
});
