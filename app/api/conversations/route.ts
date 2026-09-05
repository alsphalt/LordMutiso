import { handle, ok, badRequest } from "@/lib/api";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { ensureDm, convDto, canMessage, blockedEither } from "@/lib/social";

export const dynamic = "force-dynamic";

/**
 * GET /api/conversations — the viewer's conversations, newest first.
 * Returns active (incl. unread/groups) and archived separately so the UI can
 * render All / Unread / Groups / Archived filters without extra requests.
 */
export const GET = handle(async () => {
  const user = await requireUser();
  const members = await prisma.conversationMember.findMany({
    where: { userId: user.id },
    orderBy: { conversation: { lastAt: "desc" } },
    select: { conversationId: true, archivedAt: true },
  });
  const rows = await Promise.all(members.map((m) => convDto(m.conversationId, user.id)));
  return ok({
    conversations: rows.filter((r) => !r.archived),
    archived: rows.filter((r) => r.archived),
  });
});

/** POST /api/conversations { targetId } — find or create a private 1-to-1 DM. */
export const POST = handle(async (req) => {
  const user = await requireUser();
  const body = (await req.json().catch(() => ({}))) as { targetId?: string; username?: string };
  let targetId = body.targetId;
  if (!targetId && body.username) {
    const t = await prisma.user.findUnique({ where: { username: body.username.trim().toLowerCase() }, select: { id: true } });
    if (!t) throw badRequest("User not found");
    targetId = t.id;
  }
  if (!targetId || typeof targetId !== "string") throw badRequest("Missing target");
  if (targetId === user.id) throw badRequest("Cannot message yourself");

  const target = await prisma.user.findUnique({ where: { id: targetId } });
  if (!target) throw badRequest("User not found");
  if (await blockedEither(user.id, targetId)) throw badRequest("You cannot message this user");
  if (!(await canMessage(user.id, targetId))) throw badRequest("This user does not accept messages from you");

  const id = await ensureDm(user.id, targetId);
  const conv = await convDto(id, user.id);
  return ok({ conversation: conv });
});


