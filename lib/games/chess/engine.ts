/**
 * Chess engine — thin, authoritative wrapper around chess.js plus
 * server-side incremental game clocks. Seat 1 = White, seat 2 = Black.
 *
 * Clock model: each side owns an accumulator (ms). The clock of the side
 * to move runs between server actions; on every validated move the elapsed
 * time is charged and `lastTickMs` is reset. Clients render countdowns from
 * (now - lastTickMs) locally; the server remains the source of truth.
 */

import { Chess } from "chess.js";
import type { Square } from "chess.js";

export interface ChessState {
  v: 1;
  fen: string;
  sans: string[]; // move history in SAN, in order
  wMs: number; // white clock remaining
  bMs: number; // black clock remaining
  baseMs: number; // initial clock per side
  lastTickMs: number;
}

export interface ChessMoveInput {
  from: number; // 0..63
  to: number; // 0..63
  promotion?: "q" | "r" | "b" | "n";
}

export interface ChessResult {
  done: boolean;
  winner: number | null; // playerNumber (1 white, 2 black)
  draw: boolean;
}

export const squareAlg = (sq: number): string => {
  const file = "abcdefgh"[sq & 7];
  const rank = 8 - (sq >> 3);
  return file + rank;
};

export const squareNum = (alg: string): number => {
  const f = alg.charCodeAt(0) - 97;
  const r = 8 - Number(alg[1]);
  return r * 8 + f;
};

export function createChessState(clockMs = 10 * 60 * 1000, nowMs = Date.now()): ChessState {
  const c = new Chess();
  return { v: 1, fen: c.fen(), sans: [], wMs: clockMs, bMs: clockMs, baseMs: clockMs, lastTickMs: nowMs };
}

/** The seat (1|2) whose turn it is according to the FEN. */
export function chessTurnSeat(fen: string): 1 | 2 {
  try {
    return new Chess(fen).turn() === "w" ? 1 : 2;
  } catch {
    return 1;
  }
}

/** Remaining ms on a seat's clock at an instant (does not mutate). */
export function chessClockMs(s: ChessState, seat: 1 | 2, nowMs: number): number {
  const running = chessTurnSeat(s.fen) === seat && !gameOverFen(s.fen);
  const raw = seat === 1 ? s.wMs : s.bMs;
  if (!running) return raw;
  const elapsed = Math.max(0, nowMs - s.lastTickMs);
  return Math.max(0, raw - elapsed);
}

export function gameOverFen(fen: string): boolean {
  try {
    const c = new Chess(fen);
    return c.isCheckmate() || c.isStalemate() || c.isDraw() || c.isThreefoldRepetition() || c.isInsufficientMaterial();
  } catch {
    return true;
  }
}

export interface ChessStepOutcome {
  result: ChessResult;
  san: string;
  fen: string;
}

/** Validate & apply one chess move, charging the mover's clock. */
export function stepChess(s: ChessState, input: ChessMoveInput, nowMs: number): ChessStepOutcome {
  const game = new Chess(s.fen);
  const moverColor = game.turn();
  if (game.isGameOver?.() ?? (game.isCheckmate() || game.isDraw())) {
    throw new Error("The game is already over");
  }

  const elapsed = Math.max(0, nowMs - s.lastTickMs);
  if (moverColor === "w") s.wMs = Math.max(0, s.wMs - elapsed);
  else s.bMs = Math.max(0, s.bMs - elapsed);

  let moved;
  try {
    moved = game.move({
      from: squareAlg(input.from),
      to: squareAlg(input.to),
      promotion: input.promotion ?? "q",
    });
  } catch {
    moved = null;
  }
  if (!moved) throw new Error("That is not a legal chess move");

  s.fen = game.fen();
  s.sans.push(moved.san);
  s.lastTickMs = nowMs;

  // Result detection. The player who delivered checkmate is the winner.
  let winner: number | null = null;
  let draw = false;
  let done = false;
  const moverSeat = moverColor === "w" ? 1 : 2;
  if (game.isCheckmate()) {
    done = true;
    winner = moverSeat;
  } else if (game.isStalemate() || game.isDraw() || game.isThreefoldRepetition() || game.isInsufficientMaterial()) {
    done = true;
    draw = true;
  }
  return { result: { done, winner, draw }, san: moved.san, fen: s.fen };
}

export function resignChess(_s: ChessState, player: 1 | 2): ChessResult {
  return { done: true, winner: player === 1 ? 2 : 1, draw: false };
}

/** Draw by agreement once a side offers and the other accepts (not persisted in state). */
export function chessResultDraw(): ChessResult {
  return { done: true, winner: null, draw: true };
}

/** Legal moves for display purposes (client also uses chess.js directly). */
export function chessLegalTargets(fen: string, from: number): number[] {
  try {
    const game = new Chess(fen);
    const alg = squareAlg(from);
    const moves = game.moves({ square: alg as Square, verbose: true }) as Array<{ to: string }>;
    return moves.map((m) => squareNum(m.to));
  } catch {
    return [];
  }
}

export function chessInCheck(fen: string): boolean {
  try {
    return new Chess(fen).inCheck();
  } catch {
    return false;
  }
}
