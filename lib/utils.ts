/** Tiny generic utilities — server & client safe. */

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/** Trim, collapse whitespace/newlines, strip control chars (sanitization helper). */
export function sanitizeText(input: string, maxLen: number): string {
  let out = input
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "") // control chars
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (out.length > maxLen) out = out.slice(0, maxLen);
  return out;
}

export function randomInt(min: number, max: number): number {
  // max exclusive
  return Math.floor(Math.random() * (max - min)) + min;
}

export function randomRoomCode(alphabet: string, len: number): string {
  let out = "";
  for (let i = 0; i < len; i++) out += alphabet[randomInt(0, alphabet.length)];
  return out;
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function winRatePercent(won: number, played: number): number {
  if (played <= 0) return 0;
  return Math.round((won / played) * 1000) / 10;
}

/** ISO string of `date`, or "" when nullish. */
export function iso(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  return d instanceof Date ? d.toISOString() : new Date(d).toISOString();
}

export function fmtDate(isoStr: string | null | undefined): string {
  if (!isoStr) return "—";
  const d = new Date(isoStr);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function fmtDateTime(isoStr: string | null | undefined): string {
  if (!isoStr) return "—";
  const d = new Date(isoStr);
  return isNaN(d.getTime())
    ? "—"
    : d.toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function timeAgo(isoStr: string | Date | null | undefined): string {
  if (!isoStr) return "—";
  const t = typeof isoStr === "string" ? new Date(isoStr).getTime() : isoStr.getTime();
  if (isNaN(t)) return "—";
  const diff = Date.now() - t;
  const sec = Math.floor(diff / 1000);
  if (sec < 10) return "just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return fmtDate(new Date(t).toISOString());
}

/** Human duration from ms or from ISO range. */
export function fmtDurationMs(ms: number): string {
  if (!isFinite(ms) || ms <= 0) return "—";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function durationBetween(startIso: string | Date, endIso: string | Date | null | undefined): string {
  if (!endIso) return "—";
  const s = typeof startIso === "string" ? new Date(startIso).getTime() : startIso.getTime();
  const e = typeof endIso === "string" ? new Date(endIso).getTime() : endIso.getTime();
  return fmtDurationMs(e - s);
}

/** Serialize to JSON safely (handles Date/undefined via replacer). */
export function toJson(obj: unknown): string {
  return JSON.stringify(obj, (_k, v) => (typeof v === "bigint" ? v.toString() : v));
}
