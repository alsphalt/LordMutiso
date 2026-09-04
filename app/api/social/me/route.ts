import { handle, ok, badRequest } from "@/lib/api";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { validateMediaDataUrl } from "@/lib/social";

export const dynamic = "force-dynamic";

/** PUT /api/social/me — update display name / bio / profile photo / onboarding flag. */
export const PUT = handle(async (req) => {
  const user = await requireUser();
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const data: Record<string, string | boolean | null> = {};

  if (b.displayName !== undefined) {
    const v = String(b.displayName).trim().slice(0, 40);
    if (v.length > 0) data.displayName = v;
  }
  if (b.bio !== undefined) data.bio = String(b.bio).trim().slice(0, 160);
  if (b.image !== undefined) data.image = validateMediaDataUrl(b.image === "" ? null : String(b.image), 500_000) ?? null;
  if (b.onboardingDone !== undefined && typeof b.onboardingDone === "boolean") data.onboardingDone = b.onboardingDone;

  const u = await prisma.user.update({ where: { id: user.id }, data });
  return ok({
    user: {
      id: u.id,
      username: u.username,
      displayName: u.displayName,
      image: u.image,
      bio: u.bio,
      onboardingDone: u.onboardingDone,
    },
  });
});
