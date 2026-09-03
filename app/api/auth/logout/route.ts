import { handle, ok } from "@/lib/api";
import { requireUser, destroySession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export const POST = handle(async () => {
  await requireUser();
  await destroySession();
  return ok({ ok: true });
});
