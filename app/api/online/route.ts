import { handle, ok } from "@/lib/api";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { ONLINE_WINDOW_MS } from "@/lib/constants";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  await requireUser();

  const cutoff = new Date(Date.now() - ONLINE_WINDOW_MS);

  const [count, users] = await Promise.all([
    prisma.user.count({
      where: { lastSeen: { gte: cutoff } },
    }),
    prisma.user.findMany({
      where: { lastSeen: { gte: cutoff } },
      select: { username: true, image: true, country: true },
      orderBy: { lastSeen: "desc" },
      take: 25,
    }),
  ]);

  return ok({
    count,
    users,
  });
});
