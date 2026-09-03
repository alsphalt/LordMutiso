import { test } from "node:test";
import assert from "node:assert/strict";

import { hashPassword, verifyPassword } from "../lib/auth/password";
import { sanitizeText, winRatePercent, randomRoomCode } from "../lib/utils";
import { ROOM_CODE_ALPHABET, CHAT_MAX_LENGTH } from "../lib/constants";
import { registerSchema, loginSchema, chatMessageSchema } from "../lib/validation/schemas";
import { ratingAfterWin, ratingAfterDraw } from "../lib/games/elo";
import { seatAssignment, ludoSeatAssignment } from "../lib/games/types";

test("password: hash & verify roundtrip, wrong password rejected", () => {
  const hash = hashPassword("sup3rSecret!");
  assert.notEqual(hash, "sup3rSecret!");
  assert.ok(hash.startsWith("scrypt:"));
  assert.equal(verifyPassword("sup3rSecret!", hash), true);
  assert.equal(verifyPassword("wrong", hash), false);
});

test("sanitizeText strips control characters, trims, enforces max length", () => {
  const out = sanitizeText("  hello\u0000\u0007world  \n\n ", 200);
  assert.equal(out, "helloworld");
  const capped = sanitizeText("a".repeat(CHAT_MAX_LENGTH + 50), CHAT_MAX_LENGTH);
  assert.equal(capped.length, CHAT_MAX_LENGTH);
});

test("winRatePercent computes correctly", () => {
  assert.equal(winRatePercent(5, 10), 50);
  assert.equal(winRatePercent(0, 0), 0);
  assert.equal(winRatePercent(1, 3), 33.3);
});

test("randomRoomCode uses the restricted alphabet at the right length", () => {
  for (let i = 0; i < 50; i++) {
    const code = randomRoomCode(ROOM_CODE_ALPHABET, 6);
    assert.equal(code.length, 6);
    for (const ch of code) assert.ok(ROOM_CODE_ALPHABET.includes(ch));
  }
});

test("zod: registration validation", () => {
  assert.ok(registerSchema.safeParse({ username: "alice_1", email: "a@b.co", password: "password123" }).success);
  assert.equal(registerSchema.safeParse({ username: "a", email: "a@b.co", password: "password123" }).success, false);
  assert.equal(registerSchema.safeParse({ username: "alice", email: "nope", password: "password123" }).success, false);
  assert.equal(registerSchema.safeParse({ username: "alice", email: "a@b.co", password: "short" }).success, false);
});

test("zod: login accepts email or username", () => {
  assert.ok(loginSchema.safeParse({ identifier: "alice", password: "password123" }).success);
  assert.ok(loginSchema.safeParse({ identifier: "a@b.co", password: "password123" }).success);
});

test("zod: chat message rejects empty and whitespace-only input", () => {
  assert.equal(chatMessageSchema.safeParse("").success, false);
  assert.equal(chatMessageSchema.safeParse("   ").success, false);
  assert.equal(chatMessageSchema.safeParse("hello 👋").success, true);
});

test("elo: winner gains, loser loses; draw shifts slightly", () => {
  const r = ratingAfterWin(1200, 1000);
  assert.ok(r.winner > 1200);
  assert.ok(r.loser < 1000);
  const d = ratingAfterDraw(1200, 1000);
  assert.ok(d.a < 1200 && d.a > 1100);
  assert.ok(d.b > 1000);
});

test("seatAssignment: chess & checkers are white/black", () => {
  const a = seatAssignment("CHESS", 2, 0);
  const b = seatAssignment("CHECKERS", 2, 1);
  assert.equal(a.playerNumber, 1);
  assert.equal(a.color, "WHITE");
  assert.equal(b.playerNumber, 2);
  assert.equal(b.color, "BLACK");
});

test("ludoSeatAssignment: 2 players always sit on opposite corners (TL + BR)", () => {
  const p1 = ludoSeatAssignment(2, 0);
  const p2 = ludoSeatAssignment(2, 1);
  // Player 1: top-left slot (1), RED. Player 2: bottom-right slot (3), YELLOW.
  assert.equal(p1.playerNumber, 1);
  assert.equal(p1.color, "RED");
  assert.equal(p2.playerNumber, 3);
  assert.equal(p2.color, "YELLOW");
  // The two corner slots must be diagonal — never on the same side.
  const cornerOf = (pn: number): [number, number] =>
    ({ 1: [0, 0], 2: [0, 1], 3: [1, 1], 4: [1, 0] } as Record<number, [number, number]>)[pn];
  const [r1, c1] = cornerOf(p1.playerNumber);
  const [r2, c2] = cornerOf(p2.playerNumber);
  assert.notEqual(r1, r2, "must not share a row/side");
  assert.notEqual(c1, c2, "must not share a column/side");
});

test("ludoSeatAssignment: 3-4 players keep classic corner order", () => {
  const four = [0, 1, 2, 3].map((i) => ludoSeatAssignment(4, i));
  assert.deepEqual(
    four.map((s) => [s.playerNumber, s.color]),
    [[1, "GREEN"], [2, "RED"], [3, "BLUE"], [4, "YELLOW"]]
  );
  const three = [0, 1, 2].map((i) => ludoSeatAssignment(3, i).playerNumber);
  assert.deepEqual(three, [1, 2, 3]);
});