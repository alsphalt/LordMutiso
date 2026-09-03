import { handle, ok } from "@/lib/api";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export const POST = handle(async () => {
  const user = await requireUser();

  await prisma.user.update({
    where: { id: user.id },
    data: { lastSeen: new Date() },
  });

  return ok({ ok: true });
});
