import { handle, ok, badRequest } from "@/lib/api";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { convDto } from "@/lib/social";

export const dynamic = "force-dynamic";

/**
 * POST /api/groups { name?, userIds: [] } — create a group conversation.
 * The creator is always a member; duplicate/self ids are ignored.
 */
export const POST = handle(async (req) => {
  const user = await requireUser();
  const body = (await req.json().catch(() => ({}))) as { name?: string; userIds?: string[] };
  const rawIds = Array.isArray(body.userIds) ? body.userIds.filter((x) => typeof x === "string") : [];
  if (rawIds.length === 0) throw badRequest("Add at least one member");
  const name = typeof body.name === "string" && body.name.trim().length > 0 ? body.name.trim().slice(0, 40) : null;

  const ids = Array.from(new Set([user.id, ...rawIds]));
  const found = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true } });
  if (found.length < 2) throw badRequest("Members not found");

  const conv = await prisma.conversation.create({
    data: {
      kind: "GROUP",
      name: name ?? "New Group",
      createdById: user.id,
      members: {
        create: found.map((f) => ({ userId: f.id })),
      },
    },
    select: { id: true },
  });

  const dto = await convDto(conv.id, user.id);
  return ok({ conversation: dto });
});

/** GET /api/groups — the viewer's group conversations (lightweight rows). */
export const GET = handle(async () => {
  const user = await requireUser();
  const members = await prisma.conversationMember.findMany({
    where: { userId: user.id, conversation: { kind: "GROUP" }, archivedAt: null },
    orderBy: { conversation: { lastAt: "desc" } },
    select: { conversationId: true },
  });
  const rows = await Promise.all(members.map((m) => convDto(m.conversationId, user.id)));
  return ok({ groups: rows });
});
