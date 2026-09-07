/**
 * Physical dice math — face/pose conventions (pure helpers in
 * lib/games/ludo/dice.ts). The DOM cube, the cannon-es simulation and the
 * server all share these conventions, so invariants here protect sync.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_DICE_POSE,
  poseQuatForFace,
  randomDicePose,
  normalizeDicePose,
  posesEqual,
  topFaceOf,
  quatMul,
  quatConj,
} from "../lib/games/ludo/dice";

test("identity pose shows face 1 (the resting convention)", () => {
  assert.equal(topFaceOf(DEFAULT_DICE_POSE), 1);
});

test("poseQuatForFace always orients the requested face toward the viewer", () => {
  for (let v = 1; v <= 6; v++) {
    for (let i = 0; i < 60; i++) {
      const q = poseQuatForFace(v, Math.random() * Math.PI * 2);
      assert.equal(topFaceOf(q), v);
    }
  }
});

test("randomDicePose(die) lands with the rolled value readable on top", () => {
  for (let i = 0; i < 100; i++) {
    const die = 1 + (i % 6);
    const p = randomDicePose(die);
    assert.equal(topFaceOf(p), die);
    assert.ok(p.x > 0 && p.x < 1 && p.y > 0 && p.y < 1);
  }
});

test("normalizeDicePose clamps out-of-range input and re-normalises the quaternion", () => {
  const p = normalizeDicePose({ x: 1.7, y: -0.3, qx: 9, qy: 0, qz: 0, qw: 1 });
  assert.equal(p.x, 1);
  assert.equal(p.y, 0);
  const len = Math.hypot(p.qx, p.qy, p.qz, p.qw);
  assert.ok(Math.abs(len - 1) < 1e-9);
  // Garbage -> safe default pose.
  const d = normalizeDicePose(null);
  assert.equal(d.x, DEFAULT_DICE_POSE.x);
  assert.equal(topFaceOf(d), 1);
});

test("conjugation round-trips a quaternion (frame-change helper sanity)", () => {
  const q = poseQuatForFace(5, 0.7);
  const id = quatMul(quatConj(q), q); // conj(q)*q = identity
  assert.ok(Math.abs(id.qw - 1) < 1e-9);
  assert.ok(Math.abs(id.qx) < 1e-9 && Math.abs(id.qy) < 1e-9 && Math.abs(id.qz) < 1e-9);
});

test("posesEqual tolerates tiny float drift only", () => {
  const a = randomDicePose(3);
  const b = { ...a, x: a.x + 1e-5 };
  assert.ok(posesEqual(a, b));
  const c = { ...a, x: a.x + 0.05 };
  assert.ok(!posesEqual(a, c));
});
