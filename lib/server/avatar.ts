import { badRequest } from "@/lib/api";
import { AVATAR_MAX_BYTES } from "@/lib/constants";

/**
 * Server-side helpers for DB-backed profile pictures.
 *
 * Design: uploads arrive as small, client-compressed base64 data URLs (the same
 * pattern the social stories feature uses). The bytes are stored in Neon via
 * the UserAvatar model and served from /api/avatar/[userId] — no external blob
 * storage, no new env vars. User.image simply points at the internal route, so
 * every existing avatar surface picks the picture up unchanged.
 */

const DATA_URL_RE = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/;

/** Detect the real image format from its magic bytes (defense in depth). */
function sniffMime(buf: Buffer): string | null {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "image/png";
  }
  if (
    buf.length > 12 &&
    buf.subarray(0, 4).toString("latin1") === "RIFF" &&
    buf.subarray(8, 12).toString("latin1") === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

/**
 * Validate a profile-picture upload payload and decode it.
 * Returns the image bytes + its real mime type, or throws ApiError.
 */
export function decodeAvatarDataUrl(dataUrl: string | undefined | null): { data: Buffer; mime: string } {
  if (!dataUrl) throw badRequest("Missing image data");
  const match = DATA_URL_RE.exec(dataUrl);
  if (!match) throw badRequest("Unsupported image format — use JPEG, PNG or WebP");
  const [, declared, b64] = match;

  const decoded = Buffer.from(b64, "base64");
  if (decoded.length === 0) throw badRequest("Empty image");
  if (decoded.length > AVATAR_MAX_BYTES) {
    throw badRequest(`Image is too large (max ~${Math.round(AVATAR_MAX_BYTES / 1024)}KB after compression)`);
  }

  const mime = sniffMime(decoded) ?? (declared === "png" ? "image/png" : declared === "webp" ? "image/webp" : "image/jpeg");
  if (mime !== "image/jpeg" && mime !== "image/png" && mime !== "image/webp") {
    throw badRequest("Unsupported image format — use JPEG, PNG or WebP");
  }

  return { data: decoded, mime };
}

/** Internal URL used for uploaded avatars. `v` acts as a cache-buster. */
export function avatarImagePath(userId: string, versionMs: number): string {
  return `/api/avatar/${userId}?v=${versionMs}`;
}
