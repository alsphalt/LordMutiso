import { handle, ok } from "@/lib/api";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

const LEVELS = ["EVERYONE", "CONTACTS", "NOBODY"] as const;
const UPD = ["CONTACTS", "SELECTED", "ONLY_ME"] as const;

/** GET /api/social/privacy — current settings. PUT — update (server enforced). */
export const GET = handle(async () => {
  const user = await requireUser();
  const p = await prisma.privacySettings.upsert({ where: { userId: user.id }, update: {}, create: { userId: user.id } });
  return ok({ privacy: p });
});

export const PUT = handle(async (req) => {
  const user = await requireUser();
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const data: Record<string, string | boolean> = {};
  const lvl = (v: unknown): v is "EVERYONE" | "CONTACTS" | "NOBODY" =>
    typeof v === "string" && (LEVELS as readonly string[]).includes(v);
  const upd = (v: unknown): v is "CONTACTS" | "SELECTED" | "ONLY_ME" =>
    typeof v === "string" && (UPD as readonly string[]).includes(v);
  if (b.findability !== undefined && lvl(b.findability)) data.findability = b.findability;
  if (b.messaging !== undefined && lvl(b.messaging)) data.messaging = b.messaging;
  if (b.online !== undefined && lvl(b.online)) data.online = b.online;
  if (b.profilePhoto !== undefined && lvl(b.profilePhoto)) data.profilePhoto = b.profilePhoto;
  if (b.lastSeen !== undefined && lvl(b.lastSeen)) data.lastSeen = b.lastSeen;
  if (b.updates !== undefined && upd(b.updates)) data.updates = b.updates;
  if (b.allowDiscovery !== undefined && typeof b.allowDiscovery === "boolean") data.allowDiscovery = b.allowDiscovery;

  const p = await prisma.privacySettings.upsert({
    where: { userId: user.id },
    update: data,
    create: { userId: user.id, ...data },
  });
  return ok({ privacy: p });
});
