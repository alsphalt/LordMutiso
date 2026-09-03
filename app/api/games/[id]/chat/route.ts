import { handle, readBody, ok, badRequest, forbidden, notFound } from "@/lib/api";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { chatMessageSchema } from "@/lib/validation/schemas";
import { validateAndRateLimitChat } from "@/lib/server/chat";
import { sanitizeText } from "@/lib/utils";
import { CHAT_MAX_LENGTH } from "@/lib/constants";

export const dynamic = "force-dynamic";

export const GET = handle(async (req, { params }) => {
  const user = await requireUser();
  const gameId = params?.id;
  if (!gameId) throw badRequest("Missing game ID");

  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: { players: { select: { userId: true } } },
  });
  if (!game) throw notFound("Game not found");
  if (game.createdBy !== user.id && !game.players.some((p) => p.userId === user.id)) {
    throw forbidden();
  }

  const { searchParams } = new URL(req.url);
  const before = searchParams.get("before");
  const limit = Math.min(Number(searchParams.get("limit") || 30), 100);

  const messages = await prisma.chatMessage.findMany({
    where: {
      gameId,
      ...(before ? { createdAt: { lt: new Date(before) } } : {}),
    },
    include: { sender: { select: { id: true, username: true, image: true } } },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
  });

  const hasMore = messages.length > limit;
  const page = hasMore ? messages.slice(0, limit) : messages;
  const nextCursor = hasMore ? page[page.length - 1].createdAt.toISOString() : null;

  return ok({
    messages: page.map((m) => ({
      id: m.id,
      senderId: m.senderId,
      username: m.sender.username,
      image: m.sender.image,
      message: m.message,
      createdAt: m.createdAt.toISOString(),
    })),
    nextCursor,
  });
});

export const POST = handle(async (req, { params }) => {
  const user = await requireUser();
  const gameId = params?.id;
  if (!gameId) throw badRequest("Missing game ID");

  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: { players: { select: { userId: true } } },
  });
  if (!game) throw notFound("Game not found");
  if (game.createdBy !== user.id && !game.players.some((p) => p.userId === user.id)) {
    throw forbidden();
  }

  const body = await readBody(req);
  const message = chatMessageSchema.parse(body.message);
  const sanitized = sanitizeText(message, CHAT_MAX_LENGTH);

  await validateAndRateLimitChat(user.id, gameId);

  const msg = await prisma.chatMessage.create({
    data: {
      senderId: user.id,
      gameId,
      message: sanitized,
    },
    include: { sender: { select: { username: true, image: true } } },
  });

  return ok({
    message: {
      id: msg.id,
      senderId: msg.senderId,
      username: msg.sender.username,
      image: msg.sender.image,
      message: msg.message,
      createdAt: msg.createdAt.toISOString(),
    },
  });
});
