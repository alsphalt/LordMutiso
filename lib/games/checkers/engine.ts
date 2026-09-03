/**
 * Checkers / Draughts engine — pure & serializable.
 *
 * Board: 64 cells, row-major (row 0 = top). Only dark squares are used.
 * Seat 1 = WHITE (top, moves downward); seat 2 = BLACK (bottom, moves upward).
 *
 * Piece values:
 *   1 white man | 2 white king | 3 black man | 4 black king
 *
 * Rules implemented:
 *   - men move one diagonal step forward; kings (flying) slide any distance
 *   - captures are mandatory and jumping is forced (chains)
 *   - a piece that becomes a king ends its chain
 *   - losing all pieces or having no legal moves loses; a 60-ply
 *     capture-less stretch is a draw
 */

export const CHECKERS_BOARD = 64;

export interface CheckersMove {
  from: number;
  to: number;
  capture: boolean;
  captureIdx?: number; // enemy piece removed
  crowned?: boolean;
}

export interface CheckersState {
  v: 1;
  board: number[]; // length 64
  turn: 1 | 2; // playerNumber whose move it is
  /** While non-null the SAME player must continue capturing with this piece. */
  chain: number | null;
  ply: number;
  plySinceCapture: number;
  winner: 0 | 1 | 2 | 3; // 0 none, 1/2 playerNumber, 3 draw
}

export interface CheckersResult {
  done: boolean;
  winner: number | null;
  draw: boolean;
}

const row = (i: number) => i >> 3;
const col = (i: number) => i & 7;
const isDark = (i: number) => (row(i) + col(i)) % 2 === 1;
const idx = (r: number, c: number) => r * 8 + c;

export const isWhitePiece = (v: number) => v === 1 || v === 2;
export const isBlackPiece = (v: number) => v === 3 || v === 4;
export const isKing = (v: number) => v === 2 || v === 4;
export const pieceSide = (v: number): 1 | 2 => (isWhitePiece(v) ? 1 : 2);

export function createCheckersState(): CheckersState {
  const board = new Array<number>(64).fill(0);
  const place = (r0: number, r1: number, value: number) => {
    for (let r = r0; r <= r1; r++) {
      for (let c = 0; c < 8; c++) {
        const i = idx(r, c);
        if (isDark(i)) board[i] = value;
      }
    }
  };
  place(0, 2, 1); // white men
  place(5, 7, 3); // black men
  return { v: 1, board, turn: 1, chain: null, ply: 0, plySinceCapture: 0, winner: 0 };
}

export function piecesOf(s: CheckersState, side: 1 | 2): number[] {
  const out: number[] = [];
  s.board.forEach((v, i) => {
    if (v !== 0 && pieceSide(v) === side) out.push(i);
  });
  return out;
}

/** Collect simple (non-capture) sliding moves for a piece. */
function slideMoves(s: CheckersState, from: number): CheckersMove[] {
  const piece = s.board[from];
  if (piece === 0) return [];
  const side = pieceSide(piece);
  const dr = side === 1 ? 1 : -1; // white moves down
  const dirs = isKing(piece)
    ? [
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ]
    : [
        [dr, 1],
        [dr, -1],
      ];
  const out: CheckersMove[] = [];
  for (const [dR, dC] of dirs) {
    let r = row(from) + dR;
    let c = col(from) + dC;
    while (r >= 0 && r < 8 && c >= 0 && c < 8) {
      const i = idx(r, c);
      if (s.board[i] !== 0) break;
      out.push({ from, to: i, capture: false });
      if (!isKing(piece)) break; // men only step once
      r += dR;
      c += dC;
    }
  }
  return out;
}

/**
 * Capturing moves for a piece. For flying kings: jump the first enemy on a
 * diagonal and land on any empty square beyond it.
 */
function captureMoves(s: CheckersState, from: number): CheckersMove[] {
  const piece = s.board[from];
  if (piece === 0) return [];
  const side = pieceSide(piece);
  const dr = side === 1 ? 1 : -1;
  const dirs = isKing(piece)
    ? [
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ]
    : [
        [dr, 1],
        [dr, -1],
      ];
  const out: CheckersMove[] = [];
  for (const [dR, dC] of dirs) {
    let r = row(from) + dR;
    let c = col(from) + dC;
    let enemy: number | null = null;
    // walk: find first enemy
    while (r >= 0 && r < 8 && c >= 0 && c < 8) {
      const i = idx(r, c);
      const v = s.board[i];
      if (v !== 0) {
        if (pieceSide(v) !== side && enemy === null) {
          enemy = i;
          r += dR;
          c += dC;
          continue;
        }
        break; // blocked (own piece or second enemy)
      }
      if (enemy !== null) {
        out.push({ from, to: i, capture: true, captureIdx: enemy });
        if (!isKing(piece)) break; // men land on the very next square
      }
      r += dR;
      c += dC;
    }
  }
  return out;
}

export interface CheckersMoveSet {
  moves: CheckersMove[];
  capturesForced: boolean;
}

/**
 * Legal moves for `side` (playerNumber). When a capture chain is active the
 * same piece must continue; otherwise any capture is mandatory.
 */
export function checkersMovesFor(s: CheckersState, side: 1 | 2): CheckersMoveSet {
  const own = piecesOf(s, side);
  if (s.chain !== null) {
    if (s.turn !== side || s.board[s.chain] === 0) return { moves: [], capturesForced: true };
    return { moves: captureMoves(s, s.chain), capturesForced: true };
  }
  let captures: CheckersMove[] = [];
  const simples: CheckersMove[] = [];
  for (const p of own) {
    const piece = s.board[p];
    if (piece === 0) continue;
    const caps = captureMoves(s, p);
    if (caps.length > 0) {
      captures.push(...caps);
    } else {
      simples.push(...slideMoves(s, p));
    }
  }
  if (captures.length > 0) return { moves: captures, capturesForced: true };
  return { moves: simples, capturesForced: false };
}

export function legalCheckersMoves(s: CheckersState): CheckersMove[] {
  return checkersMovesFor(s, s.turn).moves;
}

/** Whether the side to move has any legal move / any pieces at all. */
function sideAliveAndMobile(s: CheckersState, side: 1 | 2): boolean {
  const pieces = piecesOf(s, side);
  if (pieces.length === 0) return false;
  const ms = checkersMovesFor(s, side);
  if (ms.moves.length > 0) return true;
  // No moves: maybe opponent sits blocked everywhere -> this side is stuck.
  return ms.moves.length > 0;
}

export interface CheckersStepOutcome {
  result: CheckersResult;
  move: CheckersMove;
  chainContinues: boolean;
}

/** Apply one single jump / slide. The route persists each jump as a GameMove. */
export function stepCheckers(s: CheckersState, from: number, to: number): CheckersStepOutcome {
  const side = s.turn;
  const ms = checkersMovesFor(s, side);
  const move = ms.moves.find((m) => m.from === from && m.to === to);
  if (!move) throw new Error("That is not a legal checkers move");

  const piece = s.board[from];
  const captured = move.capture;

  // Perform the jump.
  s.board[from] = 0;
  s.board[to] = piece;
  let crowned = false;
  if (!isKing(piece)) {
    const lastRow = side === 1 ? 7 : 0;
    if (row(to) === lastRow) {
      s.board[to] = side === 1 ? 2 : 4;
      crowned = true;
    }
  }
  if (captured && move.captureIdx !== undefined) {
    s.board[move.captureIdx] = 0;
  }

  s.ply += 1;
  if (captured) s.plySinceCapture = 0;
  else s.plySinceCapture += 1;
  move.crowned = crowned;

  // Chain handling: a capturing piece that can still capture must continue,
  // unless it was just crowned (crowning ends the move).
  let chainContinues = false;
  if (captured && !crowned) {
    const follow = captureMoves(s, to);
    if (follow.length > 0) {
      s.chain = to;
      chainContinues = true;
    }
  }
  if (!chainContinues) {
    s.chain = null;
    s.turn = side === 1 ? 2 : 1;
  }

  // Outcome checks (only meaningful when the turn actually switched).
  let winner: number | null = null;
  let draw = false;
  let done = false;
  if (!chainContinues) {
    const nextSide = s.turn; // player who must now move
    const hasPieces = piecesOf(s, nextSide).length > 0;
    const mobile = sideAliveAndMobile(s, nextSide);
    if (!hasPieces || !mobile) {
      done = true;
      winner = side; // mover wins because the next player is stuck
    } else if (s.plySinceCapture >= 60) {
      done = true;
      draw = true;
      s.winner = 3;
    }
  }

  const result: CheckersResult = { done, winner, draw };
  if (winner !== null && winner !== 3) {
    s.winner = winner === 1 ? 1 : 2;
  }
  return { result, move, chainContinues };
}

export function resignCheckers(s: CheckersState, player: 1 | 2): CheckersResult {
  const winner = player === 1 ? 2 : 1;
  s.winner = winner;
  return { done: true, winner, draw: false };
}

/** Draw agreed or forced end (used for leave handling when only one remains). */
export function forceCheckersDraw(s: CheckersState): CheckersResult {
  s.winner = 3;
  return { done: true, winner: null, draw: true };
}

export function checkersDrawState(s: CheckersState): boolean {
  return s.winner === 3;
}

export function checkersWinner(s: CheckersState): number | null {
  return s.winner === 1 || s.winner === 2 ? s.winner : null;
}
