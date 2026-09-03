import { handle, ok, badRequest } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { leaveRoom } from "@/lib/server/rooms";

export const dynamic = "force-dynamic";

export const POST = handle(async (req, { params }) => {
  const user = await requireUser();
  const id = params?.id;
  if (!id) throw badRequest("Missing game ID");

  await leaveRoom(id, user.id);

  return ok({ ok: true });
});
