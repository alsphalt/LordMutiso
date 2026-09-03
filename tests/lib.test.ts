import { test } from "node:test";
import assert from "node:assert/strict";

import { hashPassword, verifyPassword } from "../lib/auth/password";
import { sanitizeText, winRatePercent, randomRoomCode } from "../lib/utils";
import { ROOM_CODE_ALPHABET, CHAT_MAX_LENGTH } from "../lib/constants";
import { registerSchema, loginSchema, chatMessageSchema } from "../lib/validation/schemas";
import { ratingAfterWin, ratingAfterDraw } from "../lib/games/elo";
import { colorForSeat } from "../lib/games/types";

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

test("colorForSeat maps seats deterministically", () => {
  assert.equal(colorForSeat(0, "CHESS"), "WHITE");
  assert.equal(colorForSeat(1, "CHESS"), "BLACK");
  assert.equal(colorForSeat(0, "LUDO"), "RED");
  assert.equal(colorForSeat(1, "LUDO"), "YELLOW");
  assert.equal(colorForSeat(3, "LUDO"), "BLUE");
});
