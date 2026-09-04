import { handle, ok, badRequest } from "@/lib/api";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { publicUserDto, canFind } from "@/lib/social";

export const dynamic = "force-dynamic";

/**
 * GET  /api/social/people?q=username&list=contacts
 *   - q: debounced username search (privacy + rate guarded)
 *   - list=contacts: users the viewer has added as contacts
 * POST /api/social/people { action:"add"|"remove", userId }
 */
export const GET = handle(async (req) => {
  const user = await requireUser();
  const url = new URL(req.url);
  const list = url.searchParams.get("list") === "contacts";
  const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();

  if (list) {
    const edges = await prisma.contactEdge.findMany({
      where: { ownerId: user.id },
      include: { contact: { include: { privacy: true } } },
      take: 100,
    });
    return ok({ users: edges.map((e) => publicUserDto(e.contact)) });
  }

  if (q.length < 3) return ok({ users: [] });
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { username: { contains: q } },
        { displayName: { contains: q, mode: "insensitive" } },
      ],
    },
    include: { privacy: true },
    take: 12,
  });
  const visible = [];
  for (const u of users) {
    if (u.id === user.id) continue;
    if (await canFind(user.id, u.id)) visible.push(publicUserDto(u));
  }
  return ok({ users: visible });
});

export const POST = handle(async (req) => {
  const user = await requireUser();
  const b = (await req.json().catch(() => ({}))) as { action?: string; userId?: string };
  const targetId = b.userId;
  if (!targetId || targetId === user.id) throw badRequest("Invalid user");
  const target = await prisma.user.findUnique({ where: { id: targetId } });
  if (!target) throw badRequest("User not found");

  if (b.action === "remove") {
    await prisma.contactEdge.deleteMany({ where: { ownerId: user.id, contactId: targetId } });
    return ok({ ok: true });
  }
  if (b.action === "add") {
    // Contact edges are directional: adding someone is opt-in by the adder.
    await prisma.contactEdge.upsert({
      where: { ownerId_contactId: { ownerId: user.id, contactId: targetId } },
      update: {},
      create: { ownerId: user.id, contactId: targetId },
    });
    return ok({ ok: true });
  }
  throw badRequest("Unknown action");
});
