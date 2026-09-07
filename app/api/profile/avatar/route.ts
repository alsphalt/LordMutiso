import { handle, ok } from "@/lib/api";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { decodeAvatarDataUrl, avatarImagePath } from "@/lib/server/avatar";

export const dynamic = "force-dynamic";

/**
 * POST /api/profile/avatar
 * Body: { dataUrl: "data:image/webp;base64,..." }  (client-compressed, <=512px)
 *
 * Stores the picture in Neon (UserAvatar) and points User.image at the
 * internal /api/avatar route, so the avatar updates everywhere automatically.
 */
export const POST = handle(async (req) => {
  const user = await requireUser();
  const body = (await req.json().catch(() => ({}))) as { dataUrl?: string };

  const { data, mime } = decodeAvatarDataUrl(body.dataUrl);

  // Upsert the avatar row, then flip User.image to the internal route (with a
  // fresh cache-buster) inside the same transaction.
  const [, updated] = await prisma.$transaction([
    prisma.userAvatar.upsert({
      where: { userId: user.id },
      update: { data, mime },
      create: { userId: user.id, data, mime },
    }),
    prisma.user.update({
      where: { id: user.id },
      data: { image: avatarImagePath(user.id, Date.now()) },
      select: { id: true, username: true, email: true, image: true, createdAt: true },
    }),
  ]);

  return ok({
    user: {
      ...updated,
      createdAt: updated.createdAt.toISOString(),
    },
  });
});
