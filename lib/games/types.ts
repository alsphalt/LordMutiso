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

export type GameTypeName = "LUDO" | "CHESS" | "CHECKERS" | "TICTACTOE" | "WALLRUSH";
export type GameStatusName = "WAITING" | "PLAYING" | "FINISHED" | "DRAW" | "CANCELLED";

export interface GamePlayerDTO {
  id: string;
  userId: string | null; // null for AI seats
  username: string; // display name (bot name for AI seats)
  image: string | null;
  isAi: boolean;
  playerNumber: number;
  color: ColorName;
  score: number;
  joinedAt: string;
}

export type GameModeName = "ONLINE" | "AI";
export type AiDifficultyName = "EASY" | "MEDIUM" | "HARD";

export interface GameDTO {
  id: string;
  type: GameTypeName;
  gameMode: GameModeName;
  aiDifficulty: AiDifficultyName | null;
  status: GameStatusName;
  createdBy: string;
  winnerId: string | null;
  winnerPlayerNumber: number | null;
  currentTurn: number | null;
  roomCode: string | null;
  roomName: string | null;
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

/**
 * Seat assignment is the single source of truth for positions & colours.
 *
 * Board corner slots for Ludo: 1 = top-left, 2 = top-right, 3 = bottom-right,
 * 4 = bottom-left. The playerNumber a seat receives IS its corner slot, so the
 * engine paths, home columns, bases, centre triangles and tokens all agree.
 *
 * Layout rules (Ludo):
 *  - 1 player  -> slot 1 (TL)
 *  - 2 players -> a duel on DIAGONALLY OPPOSITE corners: seat 1 = TL (RED),
 *    seat 2 = BR (YELLOW). Never two seats on the same side.
 *  - 3-4 players -> classic order TL, TR, BR, BL with colours
 *    GREEN, RED, BLUE, YELLOW (existing 4-player positioning, unchanged).
 */
export interface SeatAssignment {
  playerNumber: number;
  color: ColorName;
}

const LUDO_CLASSIC_COLORS: ColorName[] = ["GREEN", "RED", "BLUE", "YELLOW"];

export function ludoSeatAssignment(totalSeats: number, index: number): SeatAssignment {
  if (totalSeats <= 2) {
    // Duel: opposite corners — seat 1 TL (RED), seat 2 BR (YELLOW).
    return index === 0
      ? { playerNumber: 1, color: "RED" }
      : { playerNumber: 3, color: "YELLOW" };
  }
  return {
    playerNumber: index + 1,
    color: LUDO_CLASSIC_COLORS[index] ?? "GREEN",
  };
}

/** Colours offered for a Ludo game with `totalSeats` players, in seat order. */
export function ludoColorsFor(totalSeats: number): ColorName[] {
  return Array.from({ length: totalSeats }, (_, i) => ludoSeatAssignment(totalSeats, i).color);
}

export function seatAssignment(
  gameType: GameTypeName,
  totalSeats: number,
  index: number
): SeatAssignment {
  if (gameType === "LUDO") return ludoSeatAssignment(totalSeats, index);
  // Chess & Checkers: seat 1 = WHITE, seat 2 = BLACK.
  return {
    playerNumber: index + 1,
    color: index === 0 ? "WHITE" : "BLACK",
  };
}
