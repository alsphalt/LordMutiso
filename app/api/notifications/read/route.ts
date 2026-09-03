import { handle, readBody, ok } from "@/lib/api";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export const POST = handle(async (req) => {
  const user = await requireUser();
  const body = await readBody(req);
  const ids = body.ids as string[] | undefined;

  await prisma.notification.updateMany({
    where: {
      userId: user.id,
      ...(ids ? { id: { in: ids } } : {}),
      read: false,
    },
    data: { read: true },
  });

  return ok({ ok: true });
});
