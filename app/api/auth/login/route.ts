import { handle, readBody, ok, unauthorized } from "@/lib/api";
import { prisma } from "@/lib/db";
import { loginSchema } from "@/lib/validation/schemas";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export const POST = handle(async (req) => {
  const body = await readBody(req);
  const data = loginSchema.parse(body);

  const user = await prisma.user.findFirst({
    where: {
      OR: [{ username: data.identifier }, { email: data.identifier }],
    },
  });

  if (!user || !verifyPassword(data.password, user.passwordHash)) {
    throw unauthorized("Invalid username or password");
  }

  const authUser = await createSession(user.id);
  return ok({ user: authUser });
});
