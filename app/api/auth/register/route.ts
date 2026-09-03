import { handle, readBody, ok, conflict, unauthorized } from "@/lib/api";
import { prisma } from "@/lib/db";
import { registerSchema } from "@/lib/validation/schemas";
import { hashPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { ensureUserStats } from "@/lib/stats";

export const dynamic = "force-dynamic";

export const POST = handle(async (req) => {
  const body = await readBody(req);
  const data = registerSchema.parse(body);

  const existing = await prisma.user.findFirst({
    where: {
      OR: [{ username: data.username }, { email: data.email }],
    },
  });

  if (existing) {
    throw conflict("Username or email already in use");
  }

  const user = await prisma.user.create({
    data: {
      username: data.username,
      email: data.email,
      passwordHash: hashPassword(data.password),
    },
  }).catch((e) => {
    if (e && typeof e === "object" && (e as { code?: string }).code === "P2002") {
      throw conflict("Username or email already in use");
    }
    throw e;
  });

  await ensureUserStats(user.id);
  const authUser = await createSession(user.id);

  return ok({ user: authUser });
});
