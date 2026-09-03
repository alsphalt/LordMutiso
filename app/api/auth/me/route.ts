import { handle, ok } from "@/lib/api";
import { getSessionUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  const user = await getSessionUser();
  return ok({ user });
});
