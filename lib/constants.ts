/**
 * Shared constants — safe for both server and client bundles.
 * Keep this file free of Node-only imports.
 */

export const APP_NAME = "DARKNOTE GAMING ARENA";

export const COOKIE_NAME = "dna_session";

export const SESSION_TTL_DAYS = 30;
export const SESSION_SLIDING_RENEW_DAYS = 15;

export const ONLINE_WINDOW_MS = 2 * 60 * 1000; // 2 minutes

export const CHAT_MAX_LENGTH = 500;
export const CHAT_PAGE_SIZE = 30;
export const CHAT_RATE_WINDOW_MS = 4000; // min gap between two messages by one user
export const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,20}$/;
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I/L

export type GameTypeKey = "LUDO" | "CHESS" | "CHECKERS";
export type GameStatusKey = "WAITING" | "PLAYING" | "FINISHED" | "DRAW" | "CANCELLED";
/** Aliases matching the names used by lib/games/types (client & server code imports either). */
export type GameTypeName = GameTypeKey;
export type GameStatusName = GameStatusKey;

export interface GameTypeMeta {
  key: GameTypeKey;
  label: string;
  tagline: string;
  minPlayers: number;
  maxPlayers: number;
  emoji: string;
}

export const GAME_TYPES: Record<string, GameTypeMeta> = {
  LUDO: {
    key: "LUDO",
    label: "Ludo",
    tagline: "Race your tokens around the board",
    minPlayers: 2,
    maxPlayers: 4,
    emoji: "🎲",
  },
  CHESS: {
    key: "CHESS",
    label: "Chess",
    tagline: "Classic battle of kings",
    minPlayers: 2,
    maxPlayers: 2,
    emoji: "♟️",
  },
  CHECKERS: {
    key: "CHECKERS",
    label: "Checkers",
    tagline: "Jump, capture, crown kings",
    minPlayers: 2,
    maxPlayers: 2,
    emoji: "🔴",
  },
};

export const GAME_TYPE_LIST: GameTypeKey[] = ["LUDO", "CHESS", "CHECKERS"];

export const STATUS_LABEL: Record<string, string> = {
  WAITING: "Waiting",
  PLAYING: "Playing",
  FINISHED: "Finished",
  DRAW: "Draw",
  CANCELLED: "Cancelled",
};

/** DiceBear avatar generator used for users without a custom image. */
export function avatarFor(username: string): string {
  return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(username)}&backgroundColor=8b5cf6,22d3ee,6d28d9,0e7490`;
}
