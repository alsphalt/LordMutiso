"use client";

import * as React from "react";
import type { ReactNode } from "react";
import type { GameSnapshot } from "@/lib/games/types";
import { COLOR_HEX } from "@/lib/games/types";
import { cn } from "@/lib/utils";
import { legalLudoMoves, ludoSafeCells, LUDO_FINISH } from "@/lib/games/ludo/engine";
import type { LudoState } from "@/lib/games/ludo/engine";
import { sfx, unlockAudio, isSoundMuted, setSoundMuted } from "@/lib/audio/sound";
import { LudoPhysicalDice } from "./ludo-dice/physics-dice";
import type { PhysicsDiceHandle } from "./ludo-dice/physics-dice";
import type { LudoDicePose } from "@/lib/games/ludo/dice";
import {
  DEFAULT_DICE_POSE,
  normalizeDicePose,
  posesEqual,
  poseQuatForFace,
} from "@/lib/games/ludo/dice";

/* =====================================================================
 * DARKNOTE Ludo board — polished gameplay client.
 *
 * - Logical grid of 15x15 cells; every cell centre is derived from the
 *   grid, so pieces scale with the board on any screen.
 * - The dice is a REAL physics object (cannon-es) living INSIDE the board.
 *   Its pose is part of the authoritative game state (state.dice): after a
 *   roll the cube STAYS where it landed and the next player rolls from that
 *   exact spot — it is never teleported or reset.
 * - The current player swipes the die; the roll VALUE is the physical top
 *   face of the settled cube, sent to the server with the final pose.
 * - Remote/AI rolls replay onto the SAME server-confirmed pose so every
 *   client converges on one result.
 * - Server-confirmed token moves are animated box-by-box; input is locked
 *   while dice/pieces animate so rapid taps can never cause double rolls or
 *   conflicting moves.
 * ===================================================================== */

const CREAM = "#f6ecd2";
const WOOD =
  "radial-gradient(130% 120% at 18% 12%, #d3a876 0%, #b98a55 38%, #8d6337 78%, #774e28 100%)";

// absolute track cell (abs 0..51) -> grid [row, col], order matches the engine
const ABS_CELLS: Array<[number, number]> = [
  [6, 1], [6, 2], [6, 3], [6, 4], [6, 5],
  [5, 6], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6], [0, 7], [0, 8],
  [1, 8], [2, 8], [3, 8], [4, 8], [5, 8],
  [6, 9], [6, 10], [6, 11], [6, 12], [6, 13], [6, 14], [7, 14], [8, 14],
  [8, 13], [8, 12], [8, 11], [8, 10], [8, 9],
  [9, 8], [10, 8], [11, 8], [12, 8], [13, 8], [14, 8], [14, 7], [14, 6],
  [13, 6], [12, 6], [11, 6], [10, 6], [9, 6],
  [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0], [7, 0], [6, 0],
];

function homeColumnCells(pn: number): Array<{ r: number; c: number; rel: number }> {
  const out: Array<{ r: number; c: number; rel: number }> = [];
  if (pn === 1) for (let c = 1; c <= 5; c++) out.push({ r: 7, c, rel: c + 50 });
  if (pn === 2) for (let r = 1; r <= 5; r++) out.push({ r, c: 7, rel: r + 50 });
  if (pn === 3) for (let i = 0; i < 5; i++) out.push({ r: 7, c: 13 - i, rel: 51 + i });
  if (pn === 4) for (let i = 0; i < 5; i++) out.push({ r: 13 - i, c: 7, rel: 51 + i });
  return out;
}

const QUAD_CENTERS: Record<number, { r: number; c: number }> = {
  1: { r: 2.5, c: 2.5 },
  2: { r: 2.5, c: 12.5 },
  3: { r: 12.5, c: 12.5 },
  4: { r: 12.5, c: 2.5 },
};

/** Token socket offsets (grid units) inside a base, for token index 0..3. */
const SOCKET_OFFS: Array<[number, number]> = [
  [-1.05, -1.05],
  [1.05, -1.05],
  [-1.05, 1.05],
  [1.05, 1.05],
];

const FINISH_CENTERS: Record<number, { r: number; c: number }> = {
  1: { r: 7.5, c: 6.5 },
  2: { r: 6.5, c: 7.5 },
  3: { r: 7.5, c: 8.5 },
  4: { r: 8.5, c: 7.5 },
};

const GRID = 15;
const P = (cells: number) => (cells / GRID) * 100;

const sleep = (ms: number) => new Promise<void>((res) => setTimeout(res, ms));

function shade(hex: string, pct: number): string {
  const n = parseInt(hex.slice(1), 16);
  const amt = Math.round(2.55 * pct);
  const clamp = (v: number) => Math.min(255, Math.max(0, v));
  const r = clamp((n >> 16) + amt);
  const g = clamp(((n >> 8) & 0xff) + amt);
  const b = clamp((n & 0xff) + amt);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

const alpha = (hex: string, a: number) =>
  `${hex}${Math.round(a * 255).toString(16).padStart(2, "0")}`;

/** Grid position of a token (in cell units) derived purely from the logical grid. */
function gridPosOf(pn: number, rel: number, tokenIdx: number): { r: number; c: number } {
  if (rel === -1) {
    const q = QUAD_CENTERS[pn] ?? QUAD_CENTERS[1];
    const [dr, dc] = SOCKET_OFFS[tokenIdx % 4];
    return { r: q.r + dr, c: q.c + dc };
  }
  if (rel === LUDO_FINISH) return FINISH_CENTERS[pn] ?? FINISH_CENTERS[1];
  if (rel >= 51) {
    const cell = homeColumnCells(pn).find((h) => h.rel === rel);
    if (cell) return { r: cell.r, c: cell.c };
    return { r: 7, c: 7 };
  }
  const abs = ((pn - 1) * 13 + rel) % 52;
  const cell = ABS_CELLS[abs];
  if (!cell) return { r: 7, c: 7 };
  return { r: cell[0], c: cell[1] };
}

type VisualMap = Record<string, { r: number; c: number }>;
type Pos = { r: number; c: number };

interface BoardSeat {
  pn: number;
  color: string; // hex
  name: string;
}

/* ------------------------------ static layers ------------------------------ */

const StaticLayers = React.memo(function StaticLayers({
  seats,
  activePn,
  homeRelCells,
}: {
  seats: Map<number, BoardSeat>;
  activePn: number | null;
  homeRelCells: Array<{ pn: number; r: number; c: number; rel: number }>;
}) {
  const safeCells = ludoSafeCells();
  return (
    <>
      {/* shared track */}
      {ABS_CELLS.map(([r, c], abs) => {
        const isStart = abs % 13 === 0;
        const safe = safeCells.has(abs);
        return (
          <div
            key={`t${abs}`}
            className="absolute rounded-[2px]"
            style={{
              left: `${P(c)}%`,
              top: `${P(r)}%`,
              width: `${P(1)}%`,
              height: `${P(1)}%`,
              background: isStart
                ? `radial-gradient(circle at 32% 20%, rgba(255,255,255,0.95), rgba(255,255,255,0) 52%), linear-gradient(180deg, #fff8e6, #f2e2ba)`
                : `radial-gradient(circle at 32% 20%, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0) 55%), linear-gradient(180deg, #fffdf0, #f1e4c2)`,
              border: "1px solid rgba(90,60,25,0.4)",
              boxShadow: safe
                ? `inset 0 0 0 1.5px ${alpha("#8a5a28", 0.5)}, inset 0 1px 1px rgba(255,255,255,0.8)`
                : "inset 0 1px 1px rgba(255,255,255,0.8), 0 1px 1px rgba(0,0,0,0.12)",
            }}
          >
            {safe && (
              <span className="absolute inset-0 flex items-center justify-center text-[rgba(120,84,40,0.5)]">
                <svg viewBox="0 0 24 24" className="h-[55%] w-[55%]">
                  <path
                    d="M12 2l2.4 6.9 7.3.5-5.7 4.5 1.9 7-5.9-4.2-5.9 4.2 1.9-7L2.3 9.4l7.3-.5z"
                    fill="currentColor"
                  />
                </svg>
              </span>
            )}
            {isStart && (
              <span
                className="absolute rounded-full"
                style={{
                  left: "18%",
                  top: "18%",
                  width: "64%",
                  height: "64%",
                  background: "rgba(0,0,0,0.06)",
                  boxShadow: "inset 0 0 0 2px rgba(140,100,50,0.4)",
                }}
              />
            )}
          </div>
        );
      })}

      {/* home columns */}
      {homeRelCells.map((h) => {
        const seat = seats.get(h.pn);
        if (!seat) return null;
        const hex = seat.color;
        return (
          <div
            key={`h${h.pn}-${h.rel}`}
            className="absolute rounded-[2px]"
            style={{
              left: `${P(h.c)}%`,
              top: `${P(h.r)}%`,
              width: `${P(1)}%`,
              height: `${P(1)}%`,
              background: `radial-gradient(${alpha(shade(hex, -38), 0.5)} 1px, transparent 1.7px), radial-gradient(circle at 28% 16%, rgba(255,255,255,0.55), rgba(255,255,255,0) 48%), linear-gradient(160deg, ${hex}F0, ${shade(hex, -24)}B4)`,
              backgroundSize: "7px 7px, 100% 100%, 100% 100%",
              backgroundPosition: "0 0, 0 0, 0 0",
              border: "1px solid rgba(60,30,8,0.5)",
              boxShadow: "inset 0 1px 2px rgba(255,255,255,0.4), inset 0 -2px 3px rgba(0,0,0,0.18)",
            }}
          />
        );
      })}

      {/* centre triangles */}
      <div
        className="absolute"
        style={{ left: `${P(6)}%`, top: `${P(6)}%`, width: `${P(3)}%`, height: `${P(3)}%` }}
      >
        <svg viewBox="0 0 30 30" className="h-full w-full drop-shadow-[0_2px_2px_rgba(0,0,0,0.25)]">
          {(
            [
              [2, "0,0 30,0 15,15"],
              [3, "30,0 30,30 15,15"],
              [4, "0,30 30,30 15,15"],
              [1, "0,30 0,0 15,15"],
            ] as Array<[number, string]>
          ).map(([pn, pts]) => {
            const hex = seats.get(pn)?.color ?? "#cbb493";
            return (
              <polygon key={pn} points={pts} fill={hex} stroke="rgba(60,38,18,0.6)" strokeWidth={0.6} />
            );
          })}
        </svg>
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            width: "16%",
            height: "16%",
            background: "rgba(70,45,20,0.35)",
            border: "1px solid rgba(255,255,255,0.4)",
          }}
        />
      </div>

      {/* corner bases — large rounded SQUARE home panels (classic Ludo) */}
      {[...seats.values()].map((seat) => {
        const q = QUAD_CENTERS[seat.pn];
        const hex = seat.color;
        const isTurn = activePn === seat.pn;
        const baseSize = 5.0;
        const radius = "16%";
        return (
          <div
            key={`b${seat.pn}`}
            className="absolute"
            style={{
              left: `${P(q.c)}%`,
              top: `${P(q.r)}%`,
              width: `${P(baseSize)}%`,
              height: `${P(baseSize)}%`,
              transform: "translate(-50%,-50%)",
              borderRadius: radius,
              background: `linear-gradient(150deg, ${alpha(shade(hex, 32), 0.97)} 0%, ${alpha(hex, 0.92)} 46%, ${alpha(shade(hex, -26), 0.99)} 100%)`,
              border: `3px solid ${alpha(shade(hex, -42), 0.95)}`,
              boxShadow: isTurn
                ? `0 0 0 3px rgba(255,255,255,0.4), 0 0 30px 6px ${alpha(hex, 0.95)}, inset 0 -14px 24px rgba(0,0,0,0.35), inset 0 4px 10px rgba(255,255,255,0.22)`
                : `0 8px 18px rgba(0,0,0,0.45), inset 0 -14px 24px rgba(0,0,0,0.35), inset 0 4px 10px rgba(255,255,255,0.18)`,
            }}
          >
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                borderRadius: radius,
                backgroundImage:
                  "radial-gradient(ellipse at 24% 16%, rgba(255,255,255,0.5), rgba(255,255,255,0) 48%)",
              }}
            />
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                borderRadius: radius,
                border: "2px solid rgba(255,255,255,0.3)",
                boxShadow: "inset 0 0 0 2px rgba(0,0,0,0.16)",
              }}
            />
          </div>
        );
      })}

      {/* token sockets — recessed circular holders inside each home */}
      {[...seats.values()].map((seat) => {
        const q = QUAD_CENTERS[seat.pn];
        return SOCKET_OFFS.map(([dr, dc], i) => (
          <div
            key={`s${seat.pn}-${i}`}
            className="pointer-events-none absolute rounded-full"
            style={{
              left: `${P(q.c + dr)}%`,
              top: `${P(q.r + dc)}%`,
              width: `${P(1.2)}%`,
              height: `${P(1.2)}%`,
              transform: "translate(-50%,-50%)",
              background:
                "radial-gradient(circle at 50% 40%, rgba(0,0,0,0.45), rgba(0,0,0,0.72) 70%)",
              border: "2px solid rgba(255,255,255,0.42)",
              boxShadow: "inset 0 3px 7px rgba(0,0,0,0.65), 0 1px 0 rgba(255,255,255,0.4)",
            }}
          />
        ));
      })}

      {/* ghost bases for free corners — keeps the classic 4-corner board look */}
      {[1, 2, 3, 4]
        .filter((pn) => !seats.has(pn))
        .map((pn) => {
          const q = QUAD_CENTERS[pn];
          return (
            <div
              key={`g${pn}`}
              className="pointer-events-none absolute"
              style={{
                left: `${P(q.c)}%`,
                top: `${P(q.r)}%`,
                width: `${P(5.0)}%`,
                height: `${P(5.0)}%`,
                transform: "translate(-50%,-50%)",
                borderRadius: "16%",
                background: "rgba(255,255,255,0.025)",
                border: "2px dashed rgba(255,255,255,0.10)",
              }}
            />
          );
        })}
    </>
  );
});

/* ------------------------------ board ------------------------------ */

export function LudoBoard({
  snapshot,
  act,
  isActing,
}: {
  snapshot: GameSnapshot;
  act: (body: any) => Promise<any>;
  isActing: boolean;
}) {
  const { game, seats, mySeatNumber, isMyTurn } = snapshot;
  const state = snapshot.state as unknown as LudoState;

  const [boardW, setBoardW] = React.useState(0);
  const boardRef = React.useRef<HTMLDivElement>(null);
  const [visual, setVisual] = React.useState<VisualMap>({});
  const [fx, setFx] = React.useState<Record<string, "land" | "capture" | undefined>>({});

  // ------------------------------------------------------------------
  // PHYSICAL DICE STATE
  // The resting pose of the die is authoritative game state (state.dice).
  // Locally it is mirrored in `dicePose` — it is ONLY ever updated by:
  //  1. the authoritative snapshot (init / reconnect / external change)
  //  2. the landing spot of MY physics roll
  //  3. the target pose of a replayed remote/AI roll
  // Turn changes NEVER touch it — the die stays where it landed.
  // ------------------------------------------------------------------
  const initialDice = React.useMemo(() => {
    const d = (snapshot.state as Record<string, unknown>)?.dice;
    return d && typeof d === "object" ? normalizeDicePose(d as Partial<LudoDicePose>) : DEFAULT_DICE_POSE;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [dicePose, setDicePose] = React.useState<LudoDicePose>(initialDice);
  const physicsRef = React.useRef<PhysicsDiceHandle>(null);
  const mySeatRef = React.useRef<number | null>(mySeatNumber);
  mySeatRef.current = mySeatNumber;
  /** The local roll I committed (value + pose) — matched against its echo. */
  const ownCommitRef = React.useRef<{ die: number; pose: LudoDicePose } | null>(null);
  /** True while the local physics simulation is airborne (before it settles). */
  const simActiveRef = React.useRef(false);

  const queueRef = React.useRef<Array<Record<string, unknown>>>([]);
  const lastAppliedRef = React.useRef(0);
  const enqueuedRef = React.useRef(0);
  const initedRef = React.useRef(false);
  const busyRef = React.useRef(false);
  const pumpBusyRef = React.useRef(false);
  const mountedRef = React.useRef(true);
  const pendingKeysRef = React.useRef<Set<string>>(new Set());
  const glideKeysRef = React.useRef<Set<string>>(new Set());
  const rollPendingRef = React.useRef(false);

  const seatByPn = React.useMemo(() => {
    const map = new Map<number, BoardSeat>();
    for (const s of seats) {
      map.set(s.playerNumber, {
        pn: s.playerNumber,
        color: COLOR_HEX[s.color] ?? "#888",
        name: s.username,
      });
    }
    return map;
  }, [seats]);

  const [fxWin, setFxWin] = React.useState(false);
  const [soundOn, setSoundOn] = React.useState(!isSoundMuted());

  const homeRelCells = React.useMemo(() => {
    const all: Array<{ pn: number; r: number; c: number; rel: number }> = [];
    for (const pn of seatByPn.keys()) all.push(...homeColumnCells(pn).map((h) => ({ pn, ...h })));
    return all;
  }, [seatByPn]);

  const cellPx = boardW / GRID;
  const tokenPx = cellPx * 0.86;
  const homeTokenPx = cellPx * 0.74;
  // On-board dice: sized relative to the board so it reads like a real die.
  const dieSizePx = Math.max(48, Math.min(96, Math.round(boardW * 0.17)));

  const activePn = game.status === "PLAYING" ? (state.turn ?? null) : null;
  const legalMoves = React.useMemo(() => {
    if (!isMyTurn || game.status !== "PLAYING") return [];
    try {
      return legalLudoMoves(state);
    } catch {
      return [];
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, isMyTurn, game.status]);
  const legalTokens = React.useMemo(() => new Set(legalMoves.map((m) => m.token)), [legalMoves]);

  const canRoll =
    isMyTurn &&
    game.status === "PLAYING" &&
    state.phase === "ROLL" &&
    !isActing &&
    !busyRef.current &&
    !rollPendingRef.current &&
    !simActiveRef.current;
  const canRollRef = React.useRef(canRoll);
  canRollRef.current = canRoll;

  // ---------- board measurement (responsive grid) ----------
  React.useEffect(() => {
    mountedRef.current = true;
    const el = boardRef.current;
    if (!el) return;
    const update = () => {
      if (!mountedRef.current) return;
      const w = el.getBoundingClientRect().width;
      setBoardW((prev) => (Math.abs(prev - w) > 1 ? w : prev));
    };
    update();
    const ro = new ResizeObserver(() => update());
    ro.observe(el);
    return () => {
      mountedRef.current = false;
      ro.disconnect();
    };
  }, []);

  // ---------- token sync helper ----------
  const applyTokenMap = React.useCallback((next: VisualMap) => {
    setVisual((prev) => {
      let changed = false;
      const copy: VisualMap = {};
      for (const k of Object.keys(prev)) if (!(k in next)) changed = true;
      for (const k of Object.keys(next)) {
        const a = prev[k];
        const b = next[k];
        copy[k] = b;
        if (!a || Math.abs(a.r - b.r) > 1e-6 || Math.abs(a.c - b.c) > 1e-6) changed = true;
        if (!a) glideKeysRef.current.add(k);
      }
      if (!changed) return prev;
      return copy;
    });
  }, []);

  const syncFromState = React.useCallback(() => {
    if (busyRef.current || !state.tokens) return;
    const next: VisualMap = {};
    for (const [pnStr, tokenRels] of Object.entries(state.tokens)) {
      const pn = Number(pnStr);
      (tokenRels as number[]).forEach((rel, idx) => {
        const key = `${pn}:${idx}`;
        if (pendingKeysRef.current.has(key)) return; // animator owns it right now
        next[key] = gridPosOf(pn, rel, idx);
      });
    }
    applyTokenMap(next);
  }, [state, applyTokenMap]);

  React.useEffect(() => {
    syncFromState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  // Unlock audio on the first user gesture (autoplay policies).
  React.useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock, { passive: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);

  // Win fanfare + confetti, fired once when the game finishes.
  const prevStatusRef = React.useRef(game.status);
  React.useEffect(() => {
    const wasOver = prevStatusRef.current === "FINISHED" || prevStatusRef.current === "DRAW";
    prevStatusRef.current = game.status;
    if (!wasOver && game.status === "FINISHED") sfx.win();
    if (game.status === "FINISHED" || game.status === "DRAW") {
      setFxWin(true);
      const t = window.setTimeout(() => setFxWin(false), 3800);
      return () => window.clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.status]);

  // ---------- consume server-confirmed moves into the animation queue ----------
  const enqueueNewMoves = React.useCallback(() => {
    for (const m of snapshot.recentMoves) {
      // Skip anything already played OR already queued. Without the queued
      // watermark a poll arriving mid-animation could enqueue the same move
      // twice (double dice spin / double piece move = another "replay").
      if (m.moveNumber <= lastAppliedRef.current) continue;
      if (m.moveNumber <= enqueuedRef.current) continue;
      enqueuedRef.current = Math.max(enqueuedRef.current, m.moveNumber);
      const md = (m.moveData ?? {}) as Record<string, unknown>;
      if (md.kind === "ludo-roll") {
        queueRef.current.push({
          kind: "roll",
          die: md.die,
          playerNumber: md.playerNumber,
          dice: md.dice ?? null,
          moveNumber: m.moveNumber,
        });
      } else if (md.kind === "ludo-move") {
        queueRef.current.push({
          kind: "move",
          playerNumber: md.playerNumber,
          token: md.token,
          fromR: md.fromR,
          toR: md.toR,
          captured: md.capturedTokens,
          moveNumber: m.moveNumber,
        });
      }
    }
  }, [snapshot.recentMoves]);

  // ---------- animation pump ----------
  const pump = React.useCallback(async () => {
    if (pumpBusyRef.current) return;
    pumpBusyRef.current = true;
    try {
      while (queueRef.current.length > 0 && mountedRef.current) {
        const ev = queueRef.current.shift()!;
        busyRef.current = true;
        try {
          if (ev.kind === "roll") {
            const dieVal = Number(ev.die ?? 1);
            const raw = ev.dice as Partial<LudoDicePose> | null | undefined;
            const target = raw
              ? normalizeDicePose(raw)
              : { ...DEFAULT_DICE_POSE, ...poseQuatForFace(dieVal) };

            // My own physical roll echoes back from the server — the die is
            // already resting exactly there, so skip the replay animation.
            const own = ownCommitRef.current;
            const isOwnEcho =
              own !== null &&
              own.die === dieVal &&
              posesEqual(own.pose, target) &&
              Number(ev.playerNumber ?? -1) === mySeatRef.current;
            if (isOwnEcho) {
              ownCommitRef.current = null;
              setDicePose(target);
              sfx.land();
              await sleep(60);
            } else {
              // Remote / AI roll: tumble to the SAME server-confirmed pose.
              sfx.roll();
              const pd = physicsRef.current;
              if (pd) {
                await pd.replayTo(target);
                if (!mountedRef.current) return;
              } else {
                await sleep(900);
              }
              setDicePose(target);
              sfx.land();
              await sleep(80);
            }
          } else if (ev.kind === "move") {
            const pn = Number(ev.playerNumber);
            const token = Number(ev.token);
            const fromR = Number(ev.fromR);
            const toR = Number(ev.toR);
            const captures = (ev.captured as Array<{ player: number; token: number }> | undefined) ?? [];
            const key = `${pn}:${token}`;
            const pending = pendingKeysRef.current;
            pending.add(key);
            const seal = (rel: number) => {
              const pos = gridPosOf(pn, rel, token);
              setVisual((prev) => ({ ...prev, [key]: pos }));
            };
            // seed start position, then step box-by-box
            seal(Math.max(fromR, -1));
            const steps: number[] = [];
            for (let r = fromR + 1; r <= toR; r++) steps.push(r);
            for (let i = 0; i < steps.length; i++) {
              const isLast = i === steps.length - 1;
              seal(steps[i]);
              if (isLast) {
                sfx.land();
                if (toR >= 56) sfx.finish(); // engine LUDO_FINISH === 56
                setFx((f) => ({ ...f, [key]: "land" }));
                window.setTimeout(() => setFx((f) => ({ ...f, [key]: undefined })), 480);
                await sleep(300);
              } else {
                sfx.step();
                await sleep(175);
              }
            }
            // captured tokens fly back to their home socket
            if (captures.length > 0) sfx.capture();
            for (const c of captures) {
              const vk = `${c.player}:${c.token}`;
              pending.add(vk);
              const home = gridPosOf(c.player, -1, c.token);
              setVisual((prev) => ({ ...prev, [vk]: home }));
              setFx((f) => ({ ...f, [vk]: "capture" }));
              window.setTimeout(() => setFx((f) => ({ ...f, [vk]: undefined })), 420);
              await sleep(220);
              pending.delete(vk);
            }
            pending.delete(key);
          }
        } finally {
          lastAppliedRef.current = Math.max(lastAppliedRef.current, Number(ev.moveNumber ?? 0));
        }
        await sleep(60);
      }
    } finally {
      busyRef.current = false;
      pumpBusyRef.current = false;
      rollPendingRef.current = false;
      syncFromState();
    }
  }, [syncFromState]);

  React.useEffect(() => {
    // First snapshot = just restore the board silently. NEVER replay history
    // (that caused the dice/pieces to keep animating on their own after a
    // refresh or reconnect). Only NEW confirmed moves are animated.
    if (!initedRef.current) {
      initedRef.current = true;
      const maxSeen = snapshot.recentMoves.reduce((m, x) => Math.max(m, x.moveNumber), 0);
      lastAppliedRef.current = maxSeen;
      enqueuedRef.current = maxSeen;
      queueRef.current = [];
      return;
    }
    enqueueNewMoves();
    void pump();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot.recentMoves]);

  // ---------- dice interactions (swipe-to-roll, physical) ----------
  // A swipe on the die drives the real cannon-es simulation; when the cube
  // settles, its physical top face IS the roll value and the resting pose is
  // committed to the server with that value.
  const onLocalRollStart = React.useCallback(() => {
    simActiveRef.current = true;
    sfx.roll();
  }, []);

  const onLocalSettled = React.useCallback(
    (pose: LudoDicePose, value: number) => {
      simActiveRef.current = false;
      if (rollPendingRef.current || busyRef.current) return;
      rollPendingRef.current = true;
      ownCommitRef.current = { die: value, pose };
      setDicePose(pose);
      act({ action: "roll", die: value, dice: pose }).catch(() => {
        // Server rejected / network failed: un-lock so the player can re-roll.
        rollPendingRef.current = false;
        ownCommitRef.current = null;
      });
      // Safety: if the echo never arrives (e.g. disconnected), release the lock.
      window.setTimeout(() => {
        if (ownCommitRef.current) {
          ownCommitRef.current = null;
          rollPendingRef.current = false;
        }
      }, 6000);
    },
    [act]
  );

  const doMoveToken = React.useCallback(
    (pn: number, idx: number) => {
      if (busyRef.current || isActing) return;
      void act({ action: "move", token: idx }).catch(() => undefined);
    },
    [act, isActing]
  );

  // ---------- build token elements ----------
  const tokenEls: ReactNode[] = [];
  const cell = cellPx || 1;
  const visuals = visual;
  const STACK_OFF: Array<[number, number]> = [
    [-0.18, -0.14],
    [0.18, -0.14],
    [-0.18, 0.14],
    [0.18, 0.14],
  ];
  // Occupancy per exact cell — multiple tokens (e.g. two of your pieces, or
  // several finished tokens) fan out slightly so every piece stays visible,
  // selectable and inside its own square area.
  const cellCount = new Map<string, number>();
  const cellUsed = new Map<string, number>();
  for (const p of Object.values(visuals)) {
    const ck = `${p.r.toFixed(3)},${p.c.toFixed(3)}`;
    cellCount.set(ck, (cellCount.get(ck) ?? 0) + 1);
  }
  if (state.tokens) {
    for (const [pnStr, rels] of Object.entries(state.tokens)) {
      const pn = Number(pnStr);
      const seat = seatByPn.get(pn);
      if (!seat) continue;
      (rels as number[]).forEach((rel, idx) => {
        const key = `${pn}:${idx}`;
        const pos = visuals[key];
        if (!pos || !boardW) return;
        const isHome = rel === -1;
        const tpx = isHome ? homeTokenPx : tokenPx;
        const ck = `${pos.r.toFixed(3)},${pos.c.toFixed(3)}`;
        const occ = cellUsed.get(ck) ?? 0;
        cellUsed.set(ck, occ + 1);
        const off = (cellCount.get(ck) ?? 1) > 1 ? STACK_OFF[occ % STACK_OFF.length] : [0, 0];
        const x = pos.c * cell + off[0] * cell;
        const y = pos.r * cell + off[1] * cell;
        const legal = legalTokens.has(idx) && state.turn === pn && !busyRef.current;
        const effect = fx[key];
        const glide = glideKeysRef.current.has(key);
        tokenEls.push(
          <button
            key={key}
            disabled={!legal}
            onPointerDown={(e) => {
              if (legal) doMoveToken(pn, idx);
            }}
            aria-label={`${seat.name} token ${idx + 1}`}
            className={cn(
              "absolute left-0 top-0 rounded-full",
              legal ? "cursor-pointer z-40" : "cursor-default",
              legal && "token-glow"
            )}
            style={{
              width: tpx,
              height: tpx,
              color: seat.color,
              transform: `translate3d(${x - tpx / 2}px, ${y - tpx / 2}px, 0)`,
              transition: glide ? "transform 150ms cubic-bezier(.25,.6,.3,1)" : "none",
              willChange: "transform",
              // Non-selectable tokens never swallow pointer events, so the
              // physical die (which lives on the board) can always be swiped.
              pointerEvents: legal ? "auto" : "none",
              // Physical glossy token: strong specular dome, body gradient,
              // dark lower band for thickness, rim light, dark edge ring and a
              // soft contact shadow so it sits on the board like a real piece.
              background: `radial-gradient(circle at 50% 8%, rgba(255,255,255,0.65) 0%, rgba(255,255,255,0) 30%), radial-gradient(circle at 33% 26%, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0) 42%), radial-gradient(circle at 42% 42%, ${shade(seat.color, 36)} 0%, ${seat.color} 44%, ${shade(seat.color, -38)} 100%)`,
              border: `2px solid rgba(255,255,255,0.95)`,
              boxShadow: legal
                ? `0 0 0 2px rgba(255,255,255,0.95), 0 0 13px 1px ${alpha(seat.color, 0.85)}, 0 7px 12px rgba(0,0,0,0.5), inset 0 -${Math.round(tpx * 0.16)}px 0 rgba(0,0,0,0.3), inset 0 0 0 2px rgba(0,0,0,0.18)`
                : `0 4px 6px rgba(0,0,0,0.4), 0 10px 16px -6px rgba(0,0,0,0.55), inset 0 -${Math.round(tpx * 0.16)}px 0 rgba(0,0,0,0.3), inset 0 0 0 2px rgba(0,0,0,0.18)`,
              touchAction: "manipulation",
            }}
          >
            <span
              className={cn(
                "pointer-events-none absolute inset-[15%] rounded-full transition-none",
                effect === "land" && "fx-land",
                effect === "capture" && "fx-capture"
              )}
              style={{
                // dome shading: bright top, falls to shadow at the base edge
                background:
                  "linear-gradient(180deg, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0.08) 44%, rgba(0,0,0,0.32) 100%)",
                boxShadow: effect === "capture" ? "none" : "0 0 0 1px rgba(0,0,0,0.08)",
              }}
            />
          </button>
        );
      });
    }
  }

  const hint = !isMyTurn
    ? activePn !== null
      ? `${seatByPn.get(activePn)?.name ?? "Player"} is thinking…`
      : ""
    : state.phase === "ROLL"
      ? canRoll
        ? "Swipe the dice to roll"
        : "Rolling…"
      : legalTokens.size > 0
        ? "Tap a glowing token to move it"
        : "Rolling…";

  const hintTone =
    !isMyTurn ? "text-slate-400" : state.phase === "ROLL" ? "text-cyan-300" : "text-amber-300";

  return (
    <div className="flex w-full flex-col gap-3">
      {/* board — presented on a slight 3D slant like a real game table */}
      <div
        ref={boardRef}
        className="relative w-full select-none"
        style={{
          aspectRatio: "1 / 1",
          touchAction: "manipulation",
          transform: "perspective(1500px) rotateX(13deg)",
          transformOrigin: "50% 46%",
          willChange: "transform",
        }}
      >
        <div
          className="absolute inset-0 rounded-2xl"
          style={{
            background: WOOD,
            boxShadow:
              "inset 0 0 0 4px rgba(60,38,18,0.55), inset 0 0 60px rgba(0,0,0,0.28), 0 18px 40px -12px rgba(0,0,0,0.7), 0 0 46px 2px rgba(124,58,237,0.55)",
          }}
        />

        <StaticLayers seats={seatByPn} activePn={activePn} homeRelCells={homeRelCells} />

        {tokenEls}

        {/* PHYSICAL DICE — inside the board. Its pose is part of the game
            state; it rests where it lands and is never teleported. */}
        {boardW > 10 && (
          <LudoPhysicalDice
            ref={physicsRef}
            boardPx={boardW}
            sizePx={dieSizePx}
            pose={dicePose}
            canRoll={canRoll}
            glow={canRoll}
            onRollStart={onLocalRollStart}
            onSettled={onLocalSettled}
          />
        )}
      </div>

      {/* status row */}
      <div className="flex items-center justify-center gap-2 px-1">
        <button
          type="button"
          aria-pressed={soundOn}
          aria-label={soundOn ? "Mute sound" : "Unmute sound"}
          onClick={() => {
            const next = !soundOn;
            setSoundOn(next);
            setSoundMuted(!next);
            if (next) sfx.roll();
          }}
          className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-bold text-slate-300 transition-colors hover:bg-white/10"
        >
          {soundOn ? "🔊" : "🔇"}
          <span className="hidden sm:inline">{soundOn ? "Sound" : "Muted"}</span>
        </button>
        <div className="flex min-w-0 items-center gap-1.5 overflow-x-auto rounded-xl border border-white/10 bg-white/5 px-3 py-2">
          {[...seatByPn.values()].map((seat) => {
            const turn = activePn === seat.pn;
            const won = game.status === "FINISHED" && game.winnerId !== null && snapshot.seats.find((s) => s.playerNumber === seat.pn)?.userId === game.winnerId;
            return (
              <div
                key={seat.pn}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide transition-all",
                  turn ? "bg-white/15 text-white" : "text-slate-400 opacity-70"
                )}
                style={turn ? { boxShadow: `0 0 12px ${alpha(seat.color, 0.7)}` } : undefined}
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: seat.color, boxShadow: `0 0 6px ${seat.color}` }}
                />
                <span className="max-w-[92px] truncate">{seat.name}</span>
                {won && <span className="text-[11px]">👑</span>}
                {seat.pn === mySeatNumber && (
                  <span className="text-[9px] text-cyan-300">(you)</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <p className={cn("text-center text-[11px] font-semibold uppercase tracking-[0.18em]", hintTone)}>
        {hint}
      </p>
      <style>{`
        @keyframes fxLand {
          0% { transform: scale(1); }
          40% { transform: scale(1.9); }
          70% { transform: scale(0.82); }
          100% { transform: scale(1); }
        }
        .fx-land { animation: fxLand 0.38s cubic-bezier(0.3, 1.3, 0.5, 1) 0s 1; }
        @keyframes fxCapture {
          0% { transform: scale(1) rotate(0deg); opacity: 1; }
          100% { transform: scale(0.3) rotate(200deg); opacity: 0.15; }
        }
        .fx-capture { animation: fxCapture 0.4s ease-in 0s 1; }
        @keyframes tokenGlowPulse {
          0%, 100% { box-shadow: 0 0 0 3px rgba(255,255,255,0.9), 0 0 14px 1px currentColor, 0 3px 6px rgba(0,0,0,0.4); }
          50% { box-shadow: 0 0 0 3px rgba(255,255,255,0.95), 0 0 26px 7px currentColor, 0 3px 6px rgba(0,0,0,0.4); }
        }
        .token-glow { animation: tokenGlowPulse 0.85s ease-in-out infinite; }
        @keyframes confFall {
          0% { transform: translateY(-8vh) rotate(0deg); opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(106vh) rotate(720deg); opacity: 0.9; }
        }
        .confetti-bit {
          position: absolute;
          top: -6vh;
          width: 7px;
          height: 13px;
          border-radius: 2px;
          animation: confFall linear forwards;
        }
      `}</style>
      {fxWin && (
        <div aria-hidden className="pointer-events-none fixed inset-0 z-[95] overflow-hidden">
          {Array.from({ length: 72 }).map((_, i) => {
            const colors = ["#f43f5e", "#facc15", "#22c55e", "#3b82f6", "#8b5cf6", "#f97316", "#22d3ee"];
            return (
              <span
                key={i}
                className="confetti-bit"
                style={{
                  left: `${(i * 1.37 + ((i * 7) % 13)) % 100}%`,
                  background: colors[i % colors.length],
                  animationDelay: `${(i % 9) * 0.09}s`,
                  animationDuration: `${2.3 + (i % 5) * 0.32}s`,
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
