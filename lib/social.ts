import type { Prisma, User } from "@prisma/client";
import { prisma } from "@/lib/db";
import { forbidden, notFound, badRequest } from "@/lib/api";

/* ------------------------------------------------------------------ */
/* Privacy helpers — ALL enforcement happens here (never client-side). */
/* ------------------------------------------------------------------ */

export type PublicUser = {
  id: string;
  username: string;
  displayName: string | null;
  image: string | null;
  bio: string | null;
  online: boolean;
  lastSeenAt: string | null;
};

const ONLINE_MS = 2 * 60 * 1000;

export function publicUserDto(u: User & { privacy?: { online: string; lastSeen: string; profilePhoto: string } | null }): PublicUser {
  const p = u.privacy;
  const onlineNow = Date.now() - u.lastSeen.getTime() < ONLINE_MS;
  const onlineVisible = p ? p.online !== "NOBODY" : true;
  const lastSeenVisible = p ? p.lastSeen !== "NOBODY" : true;
  return {
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    image: p && p.profilePhoto === "NOBODY" ? null : u.image,
    bio: u.bio,
    online: onlineVisible ? onlineNow : false,
    lastSeenAt: lastSeenVisible ? u.lastSeen.toISOString() : null,
  };
}

export async function privacyOf(userId: string) {
  const p = await prisma.privacySettings.findUnique({ where: { userId } });
  return p ?? {
    userId,
    findability: "EVERYONE",
    messaging: "EVERYONE",
    online: "EVERYONE",
    profilePhoto: "EVERYONE",
    lastSeen: "EVERYONE",
    updates: "CONTACTS" as const,
    allowDiscovery: false,
  };
}

/** True when viewer may see/find `target` per target's privacy. */
export async function canFind(viewerId: string, targetId: string): Promise<boolean> {
  if (viewerId === targetId) return true;
  const p = await privacyOf(targetId);
  if (p.findability === "EVERYONE") return true;
  if (p.findability === "NOBODY") return false;
  return (await isContact(viewerId, targetId)) || (await isContact(targetId, viewerId));
}

export async function canMessage(viewerId: string, targetId: string): Promise<boolean> {
  if (viewerId === targetId) return false;
  const p = await privacyOf(targetId);
  if (p.messaging === "NOBODY") return false;
  if (p.messaging === "EVERYONE") return true;
  return (await isContact(viewerId, targetId)) || (await isContact(targetId, viewerId));
}

export async function isContact(aId: string, bId: string): Promise<boolean> {
  const c = await prisma.contactEdge.findUnique({
    where: { ownerId_contactId: { ownerId: aId, contactId: bId } },
    select: { id: true },
  });
  return c !== null;
}

/** Either direction blocks all messaging between the two users. */
export async function blockedEither(aId: string, bId: string): Promise<boolean> {
  const c = await prisma.block.findFirst({
    where: { OR: [{ blockerId: aId, blockedId: bId }, { blockerId: bId, blockedId: aId }] },
    select: { id: true },
  });
  return c !== null;
}

/* ------------------------------------------------------------------ */
/* Conversations                                                       */
/* ------------------------------------------------------------------ */

export async function ensureDm(aId: string, bId: string): Promise<string> {
  if (aId === bId) throw badRequest("Cannot message yourself");
  const [lo, hi] = aId < bId ? [aId, bId] : [bId, aId];
  const key = `${lo}:${hi}`;
  const existing = await prisma.conversation.findUnique({ where: { dmKey: key }, select: { id: true } });
  if (existing) return existing.id;
  try {
    const c = await prisma.conversation.create({
      data: {
        kind: "DM",
        dmKey: key,
        lastAt: new Date(),
        members: { create: [{ userId: aId }, { userId: bId }] },
      },
      select: { id: true },
    });
    return c.id;
  } catch (e) {
    // unique race → fetch the row created by the other request
    const again = await prisma.conversation.findUnique({ where: { dmKey: key }, select: { id: true } });
    if (again) return again.id;
    throw e;
  }
}

/** Conversation id the viewer is a member of, or null. */
export async function memberConv(conversationId: string, userId: string) {
  const m = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
  });
  return m;
}

export async function convDto(conversationId: string, viewerId: string) {
  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      members: { include: { user: { include: { privacy: true } } } },
      messages: { orderBy: { id: "desc" }, take: 1 },
    },
  });
  if (!conv) throw notFound("Conversation not found");
  const me = conv.members.find((m) => m.userId === viewerId);
  if (!me) throw forbidden("You are not a member of this conversation");
  const peer = conv.members.find((m) => m.userId !== viewerId)?.user ?? null;
  const last = conv.messages[0] ?? null;
  const unread = await prisma.message.count({
    where: {
      conversationId,
      senderId: { not: viewerId },
      deletedAt: null,
      ...(me.lastReadAt ? { createdAt: { gt: me.lastReadAt } } : {}),
    },
  });
  return {
    id: conv.id,
    kind: conv.kind,
    peer: peer ? publicUserDto(peer) : null,
    lastMessage: last && !last.deletedAt
      ? { id: last.id, kind: last.kind, content: last.content, createdAt: last.createdAt.toISOString(), fromMe: last.senderId === viewerId }
      : null,
    unread,
    archived: me.archivedAt !== null,
    createdAt: conv.createdAt.toISOString(),
  };
}

/** Upload guard: only small compressed data-URL images (no raw binary/files on server). */
export function validateMediaDataUrl(dataUrl: string | undefined | null, maxBytes = 400_000): string | null {
  if (!dataUrl) return null;
  if (!/^data:image\/(jpeg|png|webp);base64,/.test(dataUrl)) throw badRequest("Unsupported image format");
  const raw = dataUrl.split(",")[1] ?? "";
  const bytes = Math.floor((raw.length * 3) / 4);
  if (bytes > maxBytes) throw badRequest("Image is too large (max ~400KB)");
  return dataUrl;
}

export type Tx = Prisma.TransactionClient;
