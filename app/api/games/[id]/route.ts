import { handle, ok, badRequest } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { buildGameSnapshot } from "@/lib/games/snapshot";

export const dynamic = "force-dynamic";

export const GET = handle(async (req, { params }) => {
  const user = await requireUser();
  const id = params?.id;
  if (!id) throw badRequest("Missing game ID");

  const snapshot = await buildGameSnapshot(id, user.id);
  return ok({ snapshot });
});
