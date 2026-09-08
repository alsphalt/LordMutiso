import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createTicTacToeState,
  applyTicTacToeMove,
  legalTicTacToeMoves,
  symbolOf,
  TTT_WIN_LINES,
} from "../lib/games/tictactoe/engine";

const P = [1, 3]; // seat numbers (duel layout like other Darknote games)

function fresh() {
  return createTicTacToeState(P);
}

test("TTT: fresh state — empty board, player 1 starts, not over", () => {
  const s = fresh();
  assert.equal(s.board.length, 9);
  assert.ok(s.board.every((c) => c === null));
  assert.equal(s.turn, 1);
  assert.equal(s.over, false);
  assert.equal(symbolOf(1, P), "X");
  assert.equal(symbolOf(3, P), "O");
});

test("TTT: 8 winning lines exist (3 rows + 3 cols + 2 diagonals)", () => {
  assert.equal(TTT_WIN_LINES.length, 8);
});

test("TTT: turns alternate and occupied cells are rejected", () => {
  const s = fresh();
  applyTicTacToeMove(s, 1, 4, P); // X center
  assert.equal(s.turn, 3);
  assert.equal(s.over, false);

  // Same player cannot move again (turn validation is on the caller, but the
  // engine also ignores moves that aren't theirs only via caller guard).
  // Occupied cell is ignored.
  applyTicTacToeMove(s, 3, 4, P); // illegal (occupied) -> no change
  assert.equal(s.board[4], "X");
  assert.equal(s.turn, 3); // unchanged
});

test("TTT: X wins top row — game stops with winning cells", () => {
  const s = fresh();
  applyTicTacToeMove(s, 1, 0, P); // X
  applyTicTacToeMove(s, 3, 3, P); // O
  applyTicTacToeMove(s, 1, 1, P); // X
  applyTicTacToeMove(s, 3, 4, P); // O
  applyTicTacToeMove(s, 1, 2, P); // X wins
  assert.equal(s.over, true);
  assert.equal(s.winner, 1);
  assert.deepEqual(s.winCells, [0, 1, 2]);
  assert.equal(s.draws, false);
  // No further moves possible after terminal
  assert.deepEqual(legalTicTacToeMoves(s), []);
  applyTicTacToeMove(s, 3, 5, P);
  assert.equal(s.board[5], null);
});

test("TTT: O wins a diagonal", () => {
  const s = fresh();
  applyTicTacToeMove(s, 1, 2, P); // X
  applyTicTacToeMove(s, 3, 0, P); // O
  applyTicTacToeMove(s, 1, 5, P); // X
  applyTicTacToeMove(s, 3, 4, P); // O
  applyTicTacToeMove(s, 1, 6, P); // X
  applyTicTacToeMove(s, 3, 8, P); // O wins 0,4,8
  assert.equal(s.over, true);
  assert.equal(s.winner, 3);
  assert.deepEqual(s.winCells, [0, 4, 8]);
});

test("TTT: draw detection (cat's game)", () => {
  const s = fresh();
  // Board: X O X / X O O / O X X  — no winning line for either player.
  const seq: Array<[number, number]> = [
    [1, 0],
    [3, 1],
    [1, 2],
    [3, 4],
    [1, 3],
    [3, 5],
    [1, 7],
    [3, 6],
    [1, 8],
  ];
  for (const [pn, cell] of seq) applyTicTacToeMove(s, pn, cell, P);
  assert.equal(s.over, true);
  assert.equal(s.draws, true);
  assert.equal(s.winner, null);
});

test("TTT: legal moves list only empty cells before terminal", () => {
  const s = fresh();
  assert.deepEqual(legalTicTacToeMoves(s), [0, 1, 2, 3, 4, 5, 6, 7, 8]);
  applyTicTacToeMove(s, 1, 0, P);
  assert.deepEqual(legalTicTacToeMoves(s), [1, 2, 3, 4, 5, 6, 7, 8]);
});
