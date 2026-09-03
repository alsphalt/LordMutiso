/**
 * Ludo engine — pure, serializable, server-authoritative.
 *
 * Coordinates
 * -----------
 * The shared track has 52 cells (0..51). Each player colour starts at
 * `colorIndex * 13`. A token's position `r` is relative to its own start:
 *
 *   r = -1        -> HOME (base, needs a 6 to leave)
 *   r = 0..50     -> on the shared track; absolute cell = (start + r) % 52
 *   r = 51..56    -> private home column (6 cells); r = 56 is FINISHED
 *
 * Rolling a 6 gives an extra roll (max 3 consecutive). Landing on an
 * opponent's token on a non-safe shared cell captures it back HOME.
 * The first player to get all four tokens to r = 56 wins.
 *
 * All functions mutate `state` in place and return information about the
 * transition — the caller persists `state` to Neon afterwards.
 */

export const LUDO_TOKENS_PER_PLAYER = 4;
export const LUDO_TRACK = 52;
export const LUDO_SAFE_OFFSET = 8; // star cells sit 8 cells after each start
export const LUDO_HOME_COL_START = 51; // r where the private home column begins
export const LUDO_FINISH = 56; // r of the finishing square

export interface LudoMove {
  token: number; // token index 0..3
  fromR: number;
  toR: number;
  kind: "enter" | "move" | "home" | "finish";
  capture: boolean;
}

export interface LudoState {
  v: 1;
  /** playerNumber -> 4 relative positions (-1 = HOME, 56 = FINISHED) */
  tokens: Record<number, number[]>;
  turn: number; // playerNumber whose roll/move it is
  die: number | null; // pending die for the current MOVE phase
  phase: "ROLL" | "MOVE";
  players: number[]; // sorted seat numbers (stable)
  done: number[]; // players who finished all tokens
  resigned: number[]; // players who resigned
  consecutiveSixes: number;
  rolls: number; // total dice rolls for stats
  moves: number; // total token moves for stats
}

export interface LudoResult {
  done: boolean;
  winner: number | null; // playerNumber
  reason: "finish" | "resign" | "last-standing" | null;
}

export const ludoStartCell = (colorIndex: number) => colorIndex * 13;

export function ludoSafeCells(): Set<number> {
  const safe = new Set<number>();
  for (let c = 0; c < 4; c++) {
    safe.add(ludoStartCell(c));
    safe.add((ludoStartCell(c) + LUDO_SAFE_OFFSET) % LUDO_TRACK);
  }
  return safe;
}

/** Display order of the classic board: TL GREEN, TR RED, BR BLUE, BL YELLOW. */
export const LUDO_COLORS: Array<"RED" | "YELLOW" | "GREEN" | "BLUE"> = ["GREEN", "RED", "BLUE", "YELLOW"];

/** Absolute shared-track cell for a relative position, or null when in home column/base. */
export function ludoAbsCell(colorIndex: number, r: number): number | null {
  if (r < 0 || r > 50) return null;
  return (ludoStartCell(colorIndex) + r) % LUDO_TRACK;
}

export function createLudoState(players: number[]): LudoState {
  const sorted = [...players].sort((a, b) => a - b);
  const tokens: Record<number, number[]> = {};
  for (const p of sorted) tokens[p] = Array(LUDO_TOKENS_PER_PLAYER).fill(-1);
  return {
    v: 1,
    tokens,
    turn: sorted[0],
    die: null,
    phase: "ROLL",
    players: sorted,
    done: [],
    resigned: [],
    consecutiveSixes: 0,
    rolls: 0,
    moves: 0,
  };
}

function isFinishedToken(r: number): boolean {
  return r === LUDO_FINISH;
}

function isInPlay(r: number): boolean {
  return r >= 0 && r <= LUDO_FINISH;
}

function nextActive(s: LudoState, from: number): number | null {
  const order = [...s.players].sort((a, b) => a - b);
  for (let i = 1; i <= order.length; i++) {
    const idx = (order.indexOf(from) + i) % order.length;
    const p = order[idx];
    if (!s.done.includes(p) && !s.resigned.includes(p)) return p;
  }
  return null;
}

export function activePlayers(s: LudoState): number[] {
  return s.players.filter((p) => !s.done.includes(p) && !s.resigned.includes(p));
}

function opponentAt(s: LudoState, absCell: number, self: number): number[] {
  const safe = ludoSafeCells();
  if (safe.has(absCell)) return [];
  const found: number[] = [];
  for (const p of s.players) {
    if (p === self) continue;
    if (s.done.includes(p) || s.resigned.includes(p)) continue;
    const colorIndex = p - 1;
    s.tokens[p].forEach((r, i) => {
      if (isInPlay(r) && r <= 50 && ludoAbsCell(colorIndex, r) === absCell) {
        found.push(p * 10 + i); // encode player & token
      }
    });
  }
  return found;
}

/** Legal moves for the player whose turn it is, given `state.die`. */
export function legalLudoMoves(s: LudoState): LudoMove[] {
  if (s.phase !== "MOVE" || s.die === null) return [];
  const p = s.turn;
  const die = s.die;
  const out: LudoMove[] = [];
  const colorIndex = p - 1;

  s.tokens[p].forEach((r, token) => {
    if (isFinishedToken(r)) return;
    // From base: only a 6 releases a token.
    if (r === -1) {
      if (die === 6) {
        out.push({
          token,
          fromR: -1,
          toR: 0,
          kind: "enter",
          capture: opponentAt(s, ludoAbsCell(colorIndex, 0)!, p).length > 0,
        });
      }
      return;
    }
    const toR = r + die;
    if (toR > LUDO_FINISH) return; // exact roll required to finish / enter home column
    let kind: LudoMove["kind"] = "move";
    if (toR === LUDO_FINISH) kind = "finish";
    else if (toR >= LUDO_HOME_COL_START) kind = "home";
    const capture =
      toR <= 50 && opponentAt(s, ludoAbsCell(colorIndex, toR)!, p).length > 0;
    out.push({ token, fromR: r, toR, kind, capture });
  });

  return out;
}

function passTurn(s: LudoState): void {
  const next = nextActive(s, s.turn);
  s.turn = next ?? s.turn;
  s.die = null;
  s.phase = "ROLL";
  s.consecutiveSixes = 0;
}

export interface LudoRollOutcome {
  die: number;
  legal: LudoMove[];
  /** true when the roll produced no legal move and the turn auto-advanced */
  autoPassed: boolean;
}

/** Server rolls `die` (1..6) for the current player. */
export function rollLudo(s: LudoState, die: number): LudoRollOutcome {
  if (s.phase !== "ROLL") throw new Error("It is not time to roll");
  if (die < 1 || die > 6 || !Number.isInteger(die)) throw new Error("Invalid die value");
  s.die = die;
  s.phase = "MOVE";
  s.rolls += 1;
  if (die === 6) s.consecutiveSixes += 1;
  else s.consecutiveSixes = 0;

  const legal = legalLudoMoves(s);
  if (legal.length === 0) {
    // Cannot move anything -> wasted roll, turn passes.
    passTurn(s);
    return { die, legal: [], autoPassed: true };
  }
  return { die, legal, autoPassed: false };
}

export interface LudoCaptured {
  player: number;
  token: number;
}

export interface LudoMoveOutcome {
  result: LudoResult;
  move: LudoMove;
  captured: boolean;
  capturedList: LudoCaptured[];
  extraRoll: boolean;
}

export function moveLudoToken(s: LudoState, token: number): LudoMoveOutcome {
  if (s.phase !== "MOVE" || s.die === null) throw new Error("Roll the die first");
  const legal = legalLudoMoves(s);
  const mv = legal.find((m) => m.token === token);
  if (!mv) throw new Error("That token cannot move with the current die");

  const p = s.turn;
  const colorIndex = p - 1;
  const captured = mv.capture;
  const capturedList: LudoCaptured[] = [];

  // Apply the move.
  s.tokens[p][token] = mv.toR;
  s.moves += 1;

  // Captures.
  if (mv.toR >= 0 && mv.toR <= 50) {
    const abs = ludoAbsCell(colorIndex, mv.toR)!;
    for (const enc of opponentAt(s, abs, p)) {
      const opp = Math.floor(enc / 10);
      const oppToken = enc % 10;
      s.tokens[opp][oppToken] = -1; // back HOME
      capturedList.push({ player: opp, token: oppToken });
    }
  }

  // Finished all four?
  let result: LudoResult = { done: false, winner: null, reason: null };
  const allDone = s.tokens[p].every(isFinishedToken);
  if (allDone) {
    s.done.push(p);
    result = { done: true, winner: p, reason: "finish" };
    s.die = null;
    return { result, move: mv, captured: capturedList.length > 0, capturedList, extraRoll: false };
  }

  // Extra roll on a 6 (bounded), then continue with the same player.
  const rolledSix = s.die === 6;
  s.die = null;
  let extraRoll = false;
  if (rolledSix && s.consecutiveSixes < 3) {
    extraRoll = true;
    s.phase = "ROLL";
  } else {
    s.consecutiveSixes = 0;
    passTurn(s);
  }
  return { result, move: mv, captured: capturedList.length > 0, capturedList, extraRoll };
}

/** Handle a resignation / drop-out. Returns the game-end result when one remains. */
export function resignLudo(s: LudoState, player: number): LudoResult {
  if (!s.players.includes(player) || s.resigned.includes(player) || s.done.includes(player)) {
    return { done: false, winner: null, reason: null };
  }
  s.resigned.push(player);
  if (s.turn === player) passTurn(s);
  const alive = activePlayers(s);
  if (alive.length === 1) {
    return { done: true, winner: alive[0], reason: "last-standing" };
  }
  if (alive.length === 0) {
    return { done: true, winner: null, reason: "resign" }; // everyone left
  }
  return { done: false, winner: null, reason: null };
}

/** Player color for a seat number (1-based) in Ludo. */
export function ludoColorForSeat(seat: number): (typeof LUDO_COLORS)[number] {
  return LUDO_COLORS[(seat - 1) % 4];
}
