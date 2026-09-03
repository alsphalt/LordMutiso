import { test } from "node:test";
import assert from "node:assert/strict";

import {
  createLudoState,
  rollLudo,
  legalLudoMoves,
  moveLudoToken,
  resignLudo,
  ludoAbsCell,
  LUDO_FINISH,
} from "../lib/games/ludo/engine";
import { createCheckersState, checkersMovesFor, stepCheckers, resignCheckers } from "../lib/games/checkers/engine";
import { createChessState, stepChess, resignChess, chessTurnSeat, squareNum } from "../lib/games/chess/engine";

// ---------------- Ludo ----------------

test("ludo: needs a 6 to leave base, grants an extra roll", () => {
  const s = createLudoState([1, 2]);
  const r = rollLudo(s, 3);
  assert.equal(r.autoPassed, true); // no token can move with a 3 from base
  assert.equal(s.turn, 2); // turn auto-passed

  const s2 = createLudoState([1, 2]);
  rollLudo(s2, 6);
  assert.equal(s2.phase, "MOVE");
  const legal = legalLudoMoves(s2);
  assert.equal(legal.length, 4); // all four tokens can enter
  assert.ok(legal.every((m) => m.kind === "enter"));

  const out = moveLudoToken(s2, 0);
  assert.equal(s2.tokens[1][0], 0); // on the start cell
  assert.equal(out.extraRoll, true); // rolled a 6
  assert.equal(out.result.done, false);
});

test("ludo: captures an opponent back HOME on a non-safe cell", () => {
  const s = createLudoState([1, 2]);
  // P1 token on the start cell (r=0 -> abs 0), rolls a 1 and lands on abs 1.
  // P2 token on r=40 -> abs (13+40)%52 = 1 (not a safe cell), so it gets captured.
  s.tokens[1][0] = 0;
  s.tokens[2][0] = 40;
  assert.equal(ludoAbsCell(0, 1), 1);
  assert.equal(ludoAbsCell(1, 40), 1);

  s.turn = 1;
  s.die = 1;
  s.phase = "MOVE";
  const legal = legalLudoMoves(s);
  assert.ok(legal.some((m) => m.token === 0 && m.capture), "landing move should capture");

  const out = moveLudoToken(s, 0);
  assert.equal(out.captured, true);
  assert.equal(s.tokens[2][0], -1); // back HOME
  assert.equal(s.tokens[1][0], 1); // rests on abs 1 (start r0 + die 1)
});

test("ludo: exact roll reaches the finish and declares the winner", () => {
  const s = createLudoState([1, 2]);
  s.tokens[1] = [55, LUDO_FINISH, LUDO_FINISH, LUDO_FINISH];
  s.tokens[2] = [-1, -1, -1, -1];
  s.turn = 1;
  s.die = 1;
  s.phase = "MOVE";
  const out = moveLudoToken(s, 0);
  assert.equal(out.result.done, true);
  assert.equal(out.result.winner, 1);
  assert.ok(s.done.includes(1));
});

test("ludo: resignation gives the game to the last standing player", () => {
  const s = createLudoState([1, 2]);
  const res = resignLudo(s, 2);
  assert.equal(res.done, true);
  assert.equal(res.winner, 1);
});

test("ludo: overshoot of the finish is not legal", () => {
  const s = createLudoState([1, 2]);
  s.tokens[1][0] = 54; // needs exactly 2 more
  s.turn = 1;
  s.die = 5;
  s.phase = "MOVE";
  const legal = legalLudoMoves(s);
  assert.equal(legal.length, 0); // cannot move 5 from 54
});

// ---------------- Checkers ----------------

test("checkers: captures are mandatory and chains continue with the same piece", () => {
  const s = createCheckersState();
  // Clear the board, place: white man 19 (r2c3), black man 28 (r3c4), black man 46 (r5c6)
  s.board = new Array(64).fill(0);
  s.board[19] = 1;
  s.board[28] = 3;
  s.board[46] = 3;
  s.turn = 1;
  s.chain = null;

  const ms = checkersMovesFor(s, 1);
  assert.equal(ms.capturesForced, true);
  const first = ms.moves.find((m) => m.from === 19 && m.to === 37);
  assert.ok(first, "jump over 28 to 37 expected");
  assert.equal(first!.captureIdx, 28);

  const step1 = stepCheckers(s, 19, 37);
  assert.equal(step1.move.capture, true);
  assert.equal(s.board[28], 0);
  assert.equal(step1.chainContinues, true); // can capture 46 next
  assert.equal(s.chain, 37);
  assert.equal(s.turn, 1); // same player continues

  const step2 = stepCheckers(s, 37, 55);
  assert.equal(step2.move.capture, true);
  assert.equal(s.board[46], 0);
  assert.equal(step2.chainContinues, false);
  assert.equal(s.turn, 2); // turn passed
});

test("checkers: crowning a man on the last row ends the chain", () => {
  const s = createCheckersState();
  s.board = new Array(64).fill(0);
  s.board[49] = 1; // white man r6c1 -> moves down to r7c0 (56)
  s.turn = 1;
  const ms = checkersMovesFor(s, 1);
  const mv = ms.moves.find((m) => m.from === 49 && m.to === 56);
  assert.ok(mv);
  const step = stepCheckers(s, 49, 56);
  assert.equal(step.move.crowned, true);
  assert.equal(s.board[56], 2); // king
  assert.equal(s.turn, 2);
});

test("checkers: player with no pieces loses", () => {
  const s = createCheckersState();
  s.board = new Array(64).fill(0);
  s.board[19] = 1;
  s.turn = 1;
  const ms = checkersMovesFor(s, 1);
  assert.ok(ms.moves.length > 0);
  const r = resignCheckers(s, 2);
  assert.equal(r.winner, 1);
});

// ---------------- Chess ----------------

test("chess: illegal moves are rejected and clocks are charged", () => {
  const s = createChessState();
  assert.equal(chessTurnSeat(s.fen), 1);
  // e2-e4
  const okMove = stepChess(s, { from: squareNum("e2"), to: squareNum("e4") }, Date.now() + 5000);
  assert.equal(okMove.san, "e4");
  assert.ok(s.wMs < s.baseMs, "white clock should be charged");
  assert.equal(chessTurnSeat(s.fen), 2);
  // White tries to move again -> illegal
  assert.throws(() => stepChess(s, { from: squareNum("e2"), to: squareNum("e4") }, Date.now()));
  // Knight-style teleport is illegal
  assert.throws(() => stepChess(s, { from: squareNum("d8"), to: squareNum("d1") }, Date.now()));
});

test("chess: fool's mate is detected with black winning", () => {
  const s = createChessState();
  const now = Date.now();
  stepChess(s, { from: squareNum("f2"), to: squareNum("f3") }, now);
  stepChess(s, { from: squareNum("e7"), to: squareNum("e5") }, now);
  stepChess(s, { from: squareNum("g2"), to: squareNum("g4") }, now);
  const final = stepChess(s, { from: squareNum("d8"), to: squareNum("h4") }, now);
  assert.equal(final.result.done, true);
  assert.equal(final.result.winner, 2);
  assert.equal(final.result.draw, false);
});

test("chess: resignation gives the game to the opponent", () => {
  const r = resignChess(createChessState(), 1);
  assert.equal(r.done, true);
  assert.equal(r.winner, 2);
});
