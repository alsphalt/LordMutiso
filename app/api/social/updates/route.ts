import { handle, ok, badRequest, notFound } from "@/lib/api";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { publicUserDto, validateMediaDataUrl } from "@/lib/social";

export const dynamic = "force-dynamic";

/**
 * GET  /api/social/updates — feed the viewer is authorized to see.
 * POST /api/social/updates — actions:
 *   create: { kind, text?, mediaUrl?, visibility, selectedIds? }
 *   delete: { storyId }
 *   view:   { storyId }
 */
export const GET = handle(async () => {
  const user = await requireUser();

  // Stories I own (incl. views)…
  const mine = await prisma.story.findMany({
    where: { userId: user.id, deletedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
    orderBy: { createdAt: "desc" },
    take: 60,
    include: { viewers: true, _count: { select: { viewers: true } } },
  });

  // …and stories I'm allowed to see.
  const contactsMe = await prisma.contactEdge.findMany({ where: { contactId: user.id }, select: { ownerId: true } });
  const contactIds = contactsMe.map((c) => c.ownerId);
  const selectedMe = await prisma.storyRecipient.findMany({
    where: { userId: user.id, story: { deletedAt: null } },
    select: { storyId: true },
  });
  const selectedIds = selectedMe.map((s) => s.storyId);

  const others = await prisma.story.findMany({
    where: {
      userId: { not: user.id },
      deletedAt: null,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
      AND: [
        {
          OR: [
            { visibility: "CONTACTS", userId: { in: contactIds } },
            { visibility: "SELECTED", id: { in: selectedIds } },
            { visibility: "ONLY_ME" }, // never shown to others
          ],
        },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 60,
    include: { user: { include: { privacy: true } }, viewers: { select: { viewerId: true } } },
  });

  const now = new Date();
  const mineDto = mine.map((s) => ({
    id: s.id,
    kind: s.kind,
    text: s.text,
    mediaUrl: s.mediaUrl,
    visibility: s.visibility,
    mine: true as const,
    author: null,
    createdAt: s.createdAt.toISOString(),
    expired: s.expiresAt !== null && s.expiresAt <= now,
    viewCount: s._count.viewers,
    seen: undefined,
  }));
  const othersDto = others.map((s) => ({
    id: s.id,
    kind: s.kind,
    text: s.text,
    mediaUrl: s.mediaUrl,
    visibility: s.visibility,
    mine: false as const,
    author: publicUserDto(s.user),
    createdAt: s.createdAt.toISOString(),
    expired: s.expiresAt !== null && s.expiresAt <= now,
    viewCount: undefined,
    seen: s.viewers.some((v) => v.viewerId === user.id),
  }));

  return ok({
    updates: [...mineDto, ...othersDto].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
  });
});

export const POST = handle(async (req) => {
  const user = await requireUser();
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  if (b.action === "delete") {
    const story = await prisma.story.findUnique({ where: { id: String(b.storyId ?? "") } });
    if (!story) throw notFound("Update not found");
    if (story.userId !== user.id) throw badRequest("You can only delete your own updates");
    await prisma.story.update({ where: { id: story.id }, data: { deletedAt: new Date() } });
    return ok({ ok: true });
  }

  if (b.action === "view") {
    const story = await prisma.story.findUnique({ where: { id: String(b.storyId ?? "") } });
    if (!story || story.userId === user.id) throw notFound("Update not found");
    await prisma.storyView.upsert({
      where: { storyId_viewerId: { storyId: story.id, viewerId: user.id } },
      update: {},
      create: { storyId: story.id, viewerId: user.id },
    });
    return ok({ ok: true });
  }

  // create
  const kind = b.kind === "IMAGE" ? "IMAGE" : "TEXT";
  const text = typeof b.text === "string" ? b.text.trim().slice(0, 2000) : null;
  if (kind === "TEXT" && !text) throw badRequest("Update text is required");
  const visibility = (["CONTACTS", "SELECTED", "ONLY_ME"] as const).includes(b.visibility as never)
    ? (b.visibility as "CONTACTS" | "SELECTED" | "ONLY_ME")
    : "CONTACTS";
  const mediaUrl = validateMediaDataUrl(typeof b.mediaUrl === "string" ? b.mediaUrl : null, 900_000);
  if (kind === "IMAGE" && !mediaUrl) throw badRequest("Image is required");

  const selectedIds = Array.isArray(b.selectedIds)
    ? (b.selectedIds as string[]).filter((x) => typeof x === "string").slice(0, 200)
    : [];

  const story = await prisma.story.create({
    data: {
      userId: user.id,
      kind,
      text,
      mediaUrl,
      visibility,
      audience: visibility === "SELECTED" ? { create: selectedIds.map((userId) => ({ userId })) } : undefined,
    },
  });
  return ok({ storyId: story.id });
});
