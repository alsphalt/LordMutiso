/**
 * Shared, serializable game DTOs & enums.
 * Keep this file free of server-only imports so client components can use it.
 */

export type ColorName = "RED" | "YELLOW" | "GREEN" | "BLUE" | "WHITE" | "BLACK";

export const COLOR_HEX: Record<ColorName, string> = {
  RED: "#f43f5e",
  YELLOW: "#facc15",
  GREEN: "#22c55e",
  BLUE: "#3b82f6",
  WHITE: "#f8fafc",
  BLACK: "#1e293b",
};

export const COLOR_LABEL: Record<ColorName, string> = {
  RED: "Red",
  YELLOW: "Yellow",
  GREEN: "Green",
  BLUE: "Blue",
  WHITE: "White",
  BLACK: "Black",
};

export type GameTypeName = "LUDO" | "CHESS" | "CHECKERS";
export type GameStatusName = "WAITING" | "PLAYING" | "FINISHED" | "DRAW" | "CANCELLED";

export interface GamePlayerDTO {
  id: string;
  userId: string;
  username: string;
  image: string | null;
  playerNumber: number;
  color: ColorName;
  score: number;
  joinedAt: string;
}

export interface GameDTO {
  id: string;
  type: GameTypeName;
  status: GameStatusName;
  createdBy: string;
  winnerId: string | null;
  currentTurn: number | null;
  roomCode: string | null;
  createdAt: string;
  startedAt: string | null;
  endedAt: string | null;
}

export interface MoveDTO {
  id: string;
  moveNumber: number;
  playerId: string;
  playerNumber: number;
  username: string;
  moveData: unknown;
  createdAt: string;
}

export interface GameSnapshot {
  game: GameDTO;
  seats: GamePlayerDTO[];
  /** Authoritative game state (JSON from Neon). */
  state: Record<string, unknown>;
  /** My seat playerNumber, 0 when I am not a player (spectator not supported). */
  mySeatNumber: number | null;
  /** True when it is my turn and the game is PLAYING. */
  isMyTurn: boolean;
  /** True when I am one of the seats. */
  isPlayer: boolean;
  /** True when the game is WAITING and I created it (can start). */
  canStart: boolean;
  recentMoves: MoveDTO[];
  /** Server clock at snapshot time (ms epoch) for clock rendering. */
  nowMs?: number;
}

export type ActionResult =
  | { ok: true; snapshot?: GameSnapshot; message?: string; redirectId?: string }
  | { ok: false; error: string };

/** Map a player seat index to a game color for a given player count. */
export function colorForSeat(seatIndex: number, gameType: GameTypeName): ColorName {
  if (gameType === "CHESS") return seatIndex === 0 ? "WHITE" : "BLACK";
  if (gameType === "CHECKERS") return seatIndex === 0 ? "WHITE" : "BLACK";
  const ludoColors: ColorName[] = ["RED", "YELLOW", "GREEN", "BLUE"];
  return ludoColors[seatIndex] ?? "RED";
}
