import { handle, ok, forbidden, notFound } from "@/lib/api";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export const DELETE = handle(async (req, { params }) => {
  const user = await requireUser();
  const id = params?.id;

  const msg = await prisma.chatMessage.findUnique({
    where: { id },
  });

  if (!msg) throw notFound();
  if (msg.senderId !== user.id) throw forbidden();

  await prisma.chatMessage.delete({ where: { id } });
  return ok({ ok: true });
});
