import { handle, ok, badRequest, forbidden, notFound } from "@/lib/api";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { memberConv, publicUserDto, validateMediaDataUrl, blockedEither } from "@/lib/social";

export const dynamic = "force-dynamic";

/**
 * GET /api/conversations/[id]?before=<messageId> — message history.
 * POST /api/conversations/[id] — actions:
 *   { action:"send", kind?, content, mediaUrl? }
 *   { action:"read" }            mark conversation read
 *   { action:"archive" }         hide locally
 *   { action:"deleteMessage", messageId }
 */
export const GET = handle(async (req, ctx) => {
  const user = await requireUser();
  const id = ctx.params.id;
  const me = await memberConv(id, user.id);
  if (!me) throw forbidden("Not a member");

  const url = new URL(req.url);
  const before = url.searchParams.get("before");
  const take = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") ?? 30) || 30));
  const peerMember = await prisma.conversationMember.findFirst({
    where: { conversationId: id, userId: { not: user.id } },
    select: { lastReadAt: true },
  });

  const messages = await prisma.message.findMany({
    where: {
      conversationId: id,
      deletedAt: null,
      ...(before ? { id: { lt: before } } : {}),
    },
    orderBy: { id: "desc" },
    take: take + 1,
    include: { sender: { include: { privacy: true } } },
  });
  const hasMore = messages.length > take;
  const page = messages.slice(0, take).reverse().map((m) => ({
    id: m.id,
    kind: m.kind,
    content: m.kind === "IMAGE" ? "[image]" : m.content,
    mediaUrl: m.mediaUrl,
    fromMe: m.senderId === user.id,
    sender: publicUserDto(m.sender),
    delivered: m.deliveredAt !== null,
    read: m.senderId === user.id
      ? peerMember?.lastReadAt !== null && peerMember?.lastReadAt !== undefined && m.createdAt <= peerMember.lastReadAt
      : me.lastReadAt !== null && m.createdAt <= me.lastReadAt,
    createdAt: m.createdAt.toISOString(),
  }));

  // Mark delivered once the recipient pulls the history.
  await prisma.message.updateMany({
    where: { conversationId: id, senderId: { not: user.id }, deliveredAt: null },
    data: { deliveredAt: new Date() },
  });

  return ok({ messages: page, hasMore, nextCursor: hasMore ? page[0]?.id ?? null : null });
});

export const POST = handle(async (req, ctx) => {
  const user = await requireUser();
  const id = ctx.params.id;
  const me = await memberConv(id, user.id);
  if (!me) throw forbidden("Not a member");

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const action = body.action;

  if (action === "read") {
    await prisma.conversationMember.update({
      where: { conversationId_userId: { conversationId: id, userId: user.id } },
      data: { lastReadAt: new Date() },
    });
    return ok({ ok: true });
  }

  if (action === "archive") {
    await prisma.conversationMember.update({
      where: { conversationId_userId: { conversationId: id, userId: user.id } },
      data: { archivedAt: new Date() },
    });
    return ok({ ok: true });
  }

  if (action === "deleteMessage") {
    const messageId = String(body.messageId ?? "");
    const msg = await prisma.message.findFirst({ where: { id: messageId, conversationId: id } });
    if (!msg) throw notFound("Message not found");
    if (msg.senderId !== user.id) throw forbidden("You can only delete your own messages");
    await prisma.message.update({ where: { id: messageId }, data: { deletedAt: new Date() } });
    return ok({ ok: true });
  }

  if (action === "send") {
    const kind = body.kind === "IMAGE" ? "IMAGE" : "TEXT";
    const raw = typeof body.content === "string" ? body.content.slice(0, 4000).trim() : "";
    if (kind === "TEXT" && raw.length === 0) throw badRequest("Empty message");
    const mediaUrl = validateMediaDataUrl(typeof body.mediaUrl === "string" ? body.mediaUrl : null);

    // Enforce DM rules at send time.
    const other = await prisma.conversationMember.findFirst({
      where: { conversationId: id, userId: { not: user.id } },
      include: { user: { include: { privacy: true } } },
    });
    if (other) {
      if (await blockedEither(user.id, other.userId)) throw badRequest("You cannot message this user");
    }

    const msg = await prisma.message.create({
      data: {
        conversationId: id,
        senderId: user.id,
        kind,
        content: kind === "TEXT" ? raw : raw,
        mediaUrl,
      },
    });
    await prisma.conversation.update({ where: { id }, data: { lastAt: new Date() } });
    return ok({
      message: {
        id: msg.id,
        kind: msg.kind,
        content: msg.content,
        mediaUrl: msg.mediaUrl,
        fromMe: true,
        delivered: false,
        read: false,
        createdAt: msg.createdAt.toISOString(),
      },
    });
  }

  throw badRequest("Unknown action");
});
