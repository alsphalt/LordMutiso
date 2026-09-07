import { handle, readBody, ok, conflict, unauthorized } from "@/lib/api";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { profileSchema } from "@/lib/validation/schemas";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

export const dynamic = "force-dynamic";

export const PATCH = handle(async (req) => {
  const user = await requireUser();
  const body = await readBody(req);
  const data = profileSchema.parse(body);

  const updates: any = {};

  if (data.username && data.username !== user.username) {
    const existing = await prisma.user.findUnique({ where: { username: data.username } });
    if (existing) throw conflict("Username already taken");
    updates.username = data.username;
  }

  if (data.image !== undefined) {
    const nextImage = (data.image || "").trim();
    updates.image = nextImage || null;
    // If the picture is cleared or replaced with an external URL, the stored
    // avatar row is no longer referenced — drop it to keep the DB tidy.
    if (!nextImage.startsWith("/api/avatar/")) {
      await prisma.userAvatar.deleteMany({ where: { userId: user.id } });
    }
  }

  if (data.newPassword) {
    const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
    if (!dbUser || !verifyPassword(data.currentPassword!, dbUser.passwordHash)) {
      throw unauthorized("Incorrect current password");
    }
    updates.passwordHash = hashPassword(data.newPassword);
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: updates,
    select: { id: true, username: true, email: true, image: true, createdAt: true },
  });

  return ok({
    user: {
      ...updated,
      createdAt: updated.createdAt.toISOString(),
    },
  });
});
