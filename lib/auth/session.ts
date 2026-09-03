import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { ApiError, unauthorized } from "@/lib/api";
import { COOKIE_NAME, SESSION_TTL_DAYS, SESSION_SLIDING_RENEW_DAYS } from "@/lib/constants";

/**
 * DB-backed sessions — no AUTH_SECRET / JWT env var required.
 *
 * The cookie only holds an opaque random token; the server stores the
 * SHA-256 hash of that token in Neon. Works across serverless instances
 * because every check hits the database.
 */

import type { AuthUser } from "@/lib/auth-types";

const hashToken = (raw: string) => createHash("sha256").update(raw).digest("hex");

const ttlSeconds = SESSION_TTL_DAYS * 24 * 60 * 60;
const slidingRenewMs = SESSION_SLIDING_RENEW_DAYS * 24 * 60 * 60 * 1000;

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

export function setSessionCookie(rawToken: string): void {
  cookies().set(COOKIE_NAME, rawToken, cookieOptions(ttlSeconds));
}

export function clearSessionCookie(): void {
  cookies().set(COOKIE_NAME, "", cookieOptions(0));
}

export async function createSession(userId: string): Promise<AuthUser> {
  const raw = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
  const session = await prisma.session.create({
    data: { tokenHash: hashToken(raw), userId, expiresAt },
  });
  setSessionCookie(raw);
  // Prune this user's stale sessions occasionally (keep newest 6).
  const stale = await prisma.session.findMany({
    where: { userId, id: { not: session.id } },
    orderBy: { createdAt: "desc" },
    skip: 5,
    select: { id: true },
  });
  if (stale.length > 0) {
    await prisma.session.deleteMany({ where: { id: { in: stale.map((s) => s.id) } } });
  }
  return loadUser(userId);
}

async function loadUser(userId: string): Promise<AuthUser> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true, email: true, image: true, createdAt: true },
  });
  if (!user) throw new ApiError(401, "Account no longer exists");
  return { ...user, createdAt: user.createdAt.toISOString() };
}

/**
 * Resolve the authenticated user from the session cookie.
 * `renew` allows sliding expiration — only pass true from route handlers /
 * server actions (never from Server Components where cookies are read-only).
 */
export async function getSessionUser(renew = false): Promise<AuthUser | null> {
  const store = cookies();
  const raw = store.get(COOKIE_NAME)?.value;
  if (!raw) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(raw) },
    select: { userId: true, expiresAt: true },
  });
  if (!session) return null;

  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.session.deleteMany({ where: { tokenHash: hashToken(raw) } });
    return null;
  }

  if (renew && session.expiresAt.getTime() - Date.now() < slidingRenewMs) {
    const next = new Date(Date.now() + ttlSeconds * 1000);
    await prisma.session.update({
      where: { tokenHash: hashToken(raw) },
      data: { expiresAt: next },
    });
    setSessionCookie(raw);
  }

  return loadUser(session.userId);
}

/** Like getSessionUser but throws 401 when missing. Use in protected APIs. */
export async function requireUser(): Promise<AuthUser> {
  const user = await getSessionUser(true);
  if (!user) throw unauthorized();
  return user;
}

/** Look up a user only by token (for logout even if the account vanished). */
export async function destroySession(): Promise<void> {
  const store = cookies();
  const raw = store.get(COOKIE_NAME)?.value;
  clearSessionCookie();
  if (raw) {
    await prisma.session.deleteMany({ where: { tokenHash: hashToken(raw) } });
  }
}
