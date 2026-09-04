import { handle, ok, badRequest } from "@/lib/api";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * POST /api/social/moderation
 *   { action:"block",   userId }
 *   { action:"unblock", userId }
 *   { action:"report",  userId, conversationId?, reason? }
 */
export const POST = handle(async (req) => {
  const user = await requireUser();
  const b = (await req.json().catch(() => ({}))) as { action?: string; userId?: string; conversationId?: string; reason?: string };
  const targetId = b.userId;
  if (!targetId || targetId === user.id) throw badRequest("Invalid user");

  if (b.action === "block") {
    await prisma.block.upsert({
      where: { blockerId_blockedId: { blockerId: user.id, blockedId: targetId } },
      update: {},
      create: { blockerId: user.id, blockedId: targetId },
    });
    return ok({ ok: true });
  }

  if (b.action === "unblock") {
    await prisma.block.deleteMany({ where: { blockerId: user.id, blockedId: targetId } });
    return ok({ ok: true });
  }

  if (b.action === "report") {
    await prisma.report.create({
      data: {
        reporterId: user.id,
        targetId,
        conversationId: b.conversationId ?? null,
        reason: (b.reason ?? "").toString().slice(0, 500),
      },
    });
    return ok({ ok: true });
  }

  throw badRequest("Unknown action");
});
