import { handle, ok } from "@/lib/api";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export const GET = handle(async (req) => {
  const user = await requireUser();

  const [items, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.notification.count({
      where: { userId: user.id, read: false },
    }),
  ]);

  return ok({
    items: items.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      gameId: n.gameId,
      read: n.read,
      createdAt: n.createdAt.toISOString(),
    })),
    unread,
  });
});
