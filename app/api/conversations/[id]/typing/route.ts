import { handle, ok, forbidden, badRequest } from "@/lib/api";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * POST /api/conversations/[id]/typing { typing: boolean }
 * Heartbeat for the "Typing…" indicator (server-stored, ~4-5s window).
 */
export const POST = handle(async (req, ctx) => {
  const user = await requireUser();
  const id = ctx.params.id;
  const body = (await req.json().catch(() => ({}))) as { typing?: boolean };
  const me = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId: id, userId: user.id } },
    select: { id: true },
  });
  if (!me) throw forbidden("Not a member");
  const typing = body.typing === true;
  await prisma.conversationMember.update({
    where: { id: me.id },
    data: typing ? { lastTypingAt: new Date() } : { lastTypingAt: null },
  });
  return ok({ typing });
});
