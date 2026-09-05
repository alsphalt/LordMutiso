/**
 * Shared chat types + tiny pure formatters used by the DARKNOTE Chats
 * screens (list + thread). Client-safe only — no server imports.
 */

export type ChatKind = "TEXT" | "IMAGE";

export interface PublicUser {
  id: string;
  username: string;
  displayName: string | null;
  image: string | null;
  bio: string | null;
  online: boolean;
  lastSeenAt: string | null;
}

export interface LastMessage {
  id: string;
  kind: ChatKind;
  content: string;
  createdAt: string;
  fromMe: boolean;
  senderName: string;
  delivered: boolean;
  read: boolean;
}

export interface Conv {
  id: string;
  kind: "DM" | "GROUP";
  name: string | null;
  avatarUrl: string | null;
  peer: PublicUser | null;
  lastMessage: LastMessage | null;
  unread: number;
  archived: boolean;
  muted: boolean;
  typing: boolean;
  lastAt: string;
  createdAt: string;
}

/** GET history returns full senders; POST send returns no sender field. */
export interface Msg {
  id: string;
  kind: ChatKind;
  content: string;
  mediaUrl: string | null;
  fromMe: boolean;
  sender?: PublicUser | null;
  delivered: boolean;
  read: boolean;
  createdAt: string;
}

export interface HistoryResponse {
  messages: Msg[];
  hasMore: boolean;
  nextCursor: string | null;
  meta: Conv;
}

/* ------------------------------------------------------------------ */
/* Formatters                                                          */
/* ------------------------------------------------------------------ */

const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

function hhmm(d: Date): string {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}

/** Conversation row time: HH:MM today, "Yesterday", else dd/MM. */
export function fmtRowTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const now = new Date();
  const diff = Math.round((dayStart(now) - dayStart(d)) / 86400000);
  if (diff === 0) return hhmm(d);
  if (diff === 1) return "Yesterday";
  return d.toLocaleDateString([], { day: "2-digit", month: "2-digit" });
}

/** Compact HH:MM used inside bubbles / thread header "last seen today". */
export function fmtClock(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : hhmm(d);
}

/** Day-separator label between bubbles. */
export function fmtDayLabel(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const now = new Date();
  const diff = Math.round((dayStart(now) - dayStart(d)) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff > 1 && diff < 7) return d.toLocaleDateString([], { weekday: "long" });
  return d.toLocaleDateString([], { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** "last seen …" line: today HH:MM / Yesterday / dd/MM/yyyy. Null when unknown. */
export function fmtLastSeen(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  const diff = Math.round((dayStart(now) - dayStart(d)) / 86400000);
  if (diff === 0) return `last seen today at ${hhmm(d)}`;
  if (diff === 1) return `last seen yesterday at ${hhmm(d)}`;
  return `last seen ${d.toLocaleDateString([], { day: "2-digit", month: "2-digit", year: "numeric" })}`;
}

/* ------------------------------------------------------------------ */
/* Display helpers                                                     */
/* ------------------------------------------------------------------ */

export function convTitle(c: Conv): string {
  if (c.kind === "GROUP") return c.name || "Group";
  return c.peer?.displayName ?? c.peer?.username ?? "Chat";
}

/** Seed used by the initials avatar when no image is present. */
export function convAvatarSeed(c: Conv): string {
  if (c.kind === "GROUP") return c.name || "Group";
  return c.peer?.displayName ?? c.peer?.username ?? "?";
}

/** Deterministic bubble-author color (hashed by the sender's stable id). */
const SENDER_PALETTE = [
  "text-cyan-400",
  "text-fuchsia-400",
  "text-emerald-400",
  "text-amber-400",
  "text-sky-400",
  "text-violet-400",
  "text-rose-400",
  "text-lime-400",
];

export function senderColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return SENDER_PALETTE[Math.abs(h) % SENDER_PALETTE.length];
}
