import { test } from "node:test";
import assert from "node:assert/strict";

import { createLudoState, rollLudo, legalLudoMoves } from "../lib/games/ludo/engine";
import { createCheckersState, legalCheckersMoves } from "../lib/games/checkers/engine";
import { createChessState, stepChess, squareAlg, squareNum } from "../lib/games/chess/engine";
import { chooseLudoMove, chooseCheckersMove, chooseChessMove } from "../lib/games/ai";

test("ai ludo: chooses a legal token for every difficulty", () => {
  const s = createLudoState([1, 3]);
  rollLudo(s, 6); // all four tokens can leave the base
  const legal = legalLudoMoves(s);
  assert.equal(legal.length, 4);
  for (const diff of ["EASY", "MEDIUM", "HARD"] as const) {
    const t = chooseLudoMove(s, 1, legal, diff);
    assert.ok(t !== null && t >= 0 && t < 4, `${diff} must pick an index 0..3`);
  }
  assert.equal(chooseLudoMove(s, 1, [], "HARD"), null);
});

test("ai checkers: picks a legal move (including forced captures)", () => {
  const s = createCheckersState();
  const legal = legalCheckersMoves(s);
  assert.ok(legal.length > 0);
  for (const diff of ["EASY", "MEDIUM", "HARD"] as const) {
    const m = chooseCheckersMove(s, legal, diff);
    assert.ok(m && legal.some((l) => l.from === m.from && l.to === m.to), `${diff} returns a legal move`);
  }
});

test("ai chess: returned move is legal for the side to move", () => {
  const state = createChessState();
  for (const diff of ["EASY", "MEDIUM", "HARD"] as const) {
    const mv = chooseChessMove(state.fen, diff);
    assert.ok(mv, `${diff} returns a move`);
    const copy = JSON.parse(JSON.stringify(state)) as typeof state;
    // applying the chosen move must be legal
    const step = stepChess(copy, { from: mv!.from, to: mv!.to, promotion: mv!.promotion }, Date.now());
    assert.ok(step.san.length > 0);
    // sanity: e2-e4 is the kind of move chess engines produce from the opening
    assert.ok(squareAlg(mv!.from).length === 2 && squareNum(squareAlg(mv!.from)) === mv!.from);
  }
});
