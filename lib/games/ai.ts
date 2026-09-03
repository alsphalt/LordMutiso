/**
 * AI decision helpers. Server-side only (imported by API/lib/server code).
 *
 * AI difficulty:
 *  - EASY:   mostly legal moves with some suboptimal randomness
 *  - MEDIUM: heuristics + a bit of randomness
 *  - HARD:   stronger evaluation (deeper chess search)
 *
 * Returns strictly LEGAL moves — the authoritative game engines validate.
 */
import { Chess } from "chess.js";
import type { Square } from "chess.js";
import type { LudoState, LudoMove } from "@/lib/games/ludo/engine";
import type { CheckersState, CheckersMove } from "@/lib/games/checkers/engine";

export type AiDifficulty = "EASY" | "MEDIUM" | "HARD";

const rand = Math.random;

/* ------------------------------------------------------------------ */
/* LUDO                                                                */
/* ------------------------------------------------------------------ */

interface LudoChoice {
  token: number;
  score: number;
}

export function chooseLudoMove(state: LudoState, player: number, legal: LudoMove[], difficulty: AiDifficulty): number | null {
  if (legal.length === 0) return null;
  if (difficulty === "EASY" && rand() < 0.35) {
    return legal[Math.floor(rand() * legal.length)].token;
  }

  const scores = legal.map((m): LudoChoice => {
    let s = 0;
    if (m.kind === "finish") s += 90;
    if (m.capture) s += 70;
    if (m.kind === "home") s += 40 + m.toR; // advance inside home column
    if (m.kind === "enter") s += 55;
    if (m.kind === "move") {
      s += m.toR; // distance already travelled
      // avoid landing on a square an opponent can capture next turn
      const abs = ((player - 1) * 13 + m.toR) % 52;
      for (const opp of state.players) {
        if (opp === player) continue;
        const oAbs = (state.tokens[opp] ?? []).map((r, i) => (r >= 0 && r <= 50 ? { r, i } : null)).filter(Boolean) as Array<{ r: number; i: number }>;
        for (const o of oAbs) {
          const oa = ((opp - 1) * 13 + o.r) % 52;
          const d = (abs - oa + 52) % 52; // cells the opponent is behind me
          if (d > 0 && d <= 6) s -= 18; // within striking distance
        }
      }
    }
    return { token: m.token, score: s };
  });

  scores.sort((a, b) => b.score - a.score);
  if (difficulty === "HARD" || rand() < 0.85) return scores[0].token;
  return scores[Math.min(1, scores.length - 1)].token; // MEDIUM: sometimes 2nd best
}

/* ------------------------------------------------------------------ */
/* CHECKERS                                                            */
/* ------------------------------------------------------------------ */

const CHECKER_MAN = 100;
const CHECKER_KING = 340;

export function chooseCheckersMove(state: CheckersState, legal: CheckersMove[], difficulty: AiDifficulty): CheckersMove | null {
  if (legal.length === 0) return null;
  if (difficulty === "EASY" && rand() < 0.3) return legal[Math.floor(rand() * legal.length)];

  const scored = legal.map((m) => {
    let s = 0;
    if (m.capture) {
      const capturedVal = state.board[m.captureIdx ?? 0];
      const isKing = capturedVal === 2 || capturedVal === 4;
      s += (isKing ? CHECKER_KING : CHECKER_MAN) + 40; // capturing is mandatory & good
    }
    if (m.crowned) s += CHECKER_KING - CHECKER_MAN + 60;
    // prefer advancing toward promotion
    const row = m.to >> 3;
    const side = state.turn;
    s += side === 1 ? row * 8 : (7 - row) * 8;
    // prefer central squares
    const col = m.to & 7;
    s += (col === 3 || col === 4 ? 6 : 0);
    return { m, s };
  });
  scored.sort((a, b) => b.s - a.s);
  if (difficulty === "HARD" || rand() < 0.8) return scored[0].m;
  return scored[Math.min(1, scored.length - 1)].m;
}

/* ------------------------------------------------------------------ */
/* CHESS                                                               */
/* ------------------------------------------------------------------ */

const PIECE_VALUES: Record<string, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };

export interface AiChessMove {
  from: number; // 0..63
  to: number;
  promotion?: "q" | "r" | "b" | "n";
}

function evalFen(fen: string): number {
  const game = new Chess(fen);
  const board = game.board();
  let score = 0;
  for (const row of board) {
    for (const sq of row) {
      if (!sq) continue;
      const v = PIECE_VALUES[sq.type] ?? 0;
      score += sq.color === "w" ? v : -v;
    }
  }
  score += game.moves().length * 2; // mobility tie-breaker
  if (game.inCheck()) score += game.turn() === "w" ? -30 : 30;
  return score;
}

function allChessMoves(fen: string): Array<{ from: number; to: number; promotion?: "q" | "r" | "b" | "n" }> {
  const game = new Chess(fen);
  const moves = game.moves({ verbose: true }) as Array<{ from: string; to: string; promotion?: "q" | "r" | "b" | "n" }>;
  const algToNum = (a: string) => {
    const f = a.charCodeAt(0) - 97;
    const r = 8 - Number(a[1]);
    return r * 8 + f;
  };
  return moves.map((m) => ({ from: algToNum(m.from), to: algToNum(m.to), promotion: m.promotion }));
}

const alg = (sq: number) => {
  const f = "abcdefgh"[sq & 7];
  const r = 8 - (sq >> 3);
  return f + r;
};

function search(fen: string, depth: number, alpha: number, beta: number, maximizing: boolean): number {
  if (depth === 0) return evalFen(fen);
  const game = new Chess(fen);
  const moves = game.moves({ verbose: true }) as Array<{ from: Square; to: Square; promotion?: Square }>;
  if (moves.length === 0) {
    if (game.isCheckmate()) return maximizing ? -100000 : 100000;
    return 0; // stalemate
  }
  if (maximizing) {
    let best = -Infinity;
    for (const m of moves) {
      game.move({ from: m.from, to: m.to, promotion: m.promotion ?? "q" });
      const v = search(game.fen(), depth - 1, alpha, beta, false);
      game.undo();
      best = Math.max(best, v);
      alpha = Math.max(alpha, v);
      if (beta <= alpha) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (const m of moves) {
      game.move({ from: m.from, to: m.to, promotion: m.promotion ?? "q" });
      const v = search(game.fen(), depth - 1, alpha, beta, true);
      game.undo();
      best = Math.min(best, v);
      beta = Math.min(beta, v);
      if (beta <= alpha) break;
    }
    return best;
  }
}

export function chooseChessMove(fen: string, difficulty: AiDifficulty): AiChessMove | null {
  const moves = allChessMoves(fen);
  if (moves.length === 0) return null;

  if (difficulty === "EASY") {
    if (rand() < 0.25) return moves[Math.floor(rand() * moves.length)];
  }

  const depth = difficulty === "HARD" ? 2 : 1;
  const turn = new Chess(fen).turn();
  const maximizing = turn === "w";

  const scored = moves.map((m) => {
    const game = new Chess(fen);
    game.move({ from: alg(m.from) as Square, to: alg(m.to) as Square, promotion: m.promotion });
    let v: number;
    if (difficulty === "EASY") {
      v = evalFen(game.fen());
    } else {
      v = search(game.fen(), depth - 1, -Infinity, Infinity, !maximizing);
    }
    // slight noise so easy/medium feel human
    if (difficulty !== "HARD") v += (rand() - 0.5) * 40;
    return { m, v };
  });

  scored.sort((a, b) => b.v - a.v);
  return scored[0].m;
}
