"use client";

import { useMemo } from "react";
import type { ReactNode } from "react";
import type { GameSnapshot, ColorName } from "@/lib/games/types";
import { COLOR_HEX } from "@/lib/games/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { legalLudoMoves, ludoSafeCells, LUDO_FINISH } from "@/lib/games/ludo/engine";
import type { LudoState } from "@/lib/games/ludo/engine";

/**
 * Classic wooden-style Ludo board.
 *
 * Layout follows the reference board: seat 1 = GREEN top-left,
 * seat 2 = RED top-right, seat 3 = BLUE bottom-right, seat 4 = YELLOW
 * bottom-left. Circular corner bases hold four token sockets, the shared
 * track is beige/cream, each home column is painted in its player colour
 * and the centre is split into four coloured triangles.
 */

const CREAM = "#f6ecd2";
const WOOD = "radial-gradient(130% 120% at 18% 12%, #d3a876 0%, #b98a55 38%, #8d6337 78%, #774e28 100%)";

// absolute track cell (abs 0..51) -> grid row/col, order matches the engine
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

/** Home-column cells per playerNumber for relative positions 51..55. */
function homeColumnCells(pn: number): Array<{ r: number; c: number; rel: number }> {
  const out: Array<{ r: number; c: number; rel: number }> = [];
  if (pn === 1) for (let c = 1; c <= 5; c++) out.push({ r: 7, c, rel: c + 50 }); // TL -> left arm
  if (pn === 2) for (let r = 1; r <= 5; r++) out.push({ r, c: 7, rel: r + 50 }); // TR -> top arm
  if (pn === 3) for (let i = 0; i < 5; i++) out.push({ r: 7, c: 13 - i, rel: 51 + i }); // BR -> right arm
  if (pn === 4) for (let i = 0; i < 5; i++) out.push({ r: 13 - i, c: 7, rel: 51 + i }); // BL -> bottom arm
  return out;
}

// Quadrant (base) centres in grid units; pn 1..4 = TL, TR, BR, BL
const QUAD_CENTERS: Record<number, { r: number; c: number }> = {
  1: { r: 2.5, c: 2.5 },
  2: { r: 2.5, c: 12.5 },
  3: { r: 12.5, c: 12.5 },
  4: { r: 12.5, c: 2.5 },
};

// Socket slots inside a base (token index 0..3 -> offset in grid units)
const SOCKETS: Array<[number, number]> = [
  [-1.05, -1.05],
  [1.05, -1.05],
  [-1.05, 1.05],
  [1.05, 1.05],
];

// Finish (rel 56) triangle centroids inside the 3x3 centre
const FINISH_CENTERS: Record<number, { r: number; c: number }> = {
  1: { r: 7.5, c: 6.5 }, // left triangle  (pn1 TL base)
  2: { r: 6.5, c: 7.5 }, // top triangle   (pn2 TR base)
  3: { r: 7.5, c: 8.5 }, // right triangle (pn3 BR base)
  4: { r: 8.5, c: 7.5 }, // bottom triangle (pn4 BL base)
};

const P = (cells: number) => (cells / 15) * 100; // grid units -> %

function shade(hex: string, pct: number): string {
  const n = parseInt(hex.slice(1), 16);
  const amt = Math.round(2.55 * pct);
  const clamp = (v: number) => Math.min(255, Math.max(0, v));
  const r = clamp((n >> 16) + amt);
  const g = clamp(((n >> 8) & 0xff) + amt);
  const b = clamp((n & 0xff) + amt);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

const alpha = (hex: string, a: number) => `${hex}${Math.round(a * 255).toString(16).padStart(2, "0")}`;

interface LudoBoardProps {
  snapshot: GameSnapshot;
  act: (body: any) => Promise<any>;
  isActing: boolean;
}

interface SeatInfo {
  pn: number;
  color: ColorName;
  hex: string;
  name: string;
}

export function LudoBoard({ snapshot, act, isActing }: LudoBoardProps) {
  const { game, seats, mySeatNumber, isMyTurn } = snapshot;
  const state = snapshot.state as unknown as LudoState;
  const safeCells = useMemo(() => ludoSafeCells(), []);

  const seatByPn = useMemo(() => {
    const map = new Map<number, SeatInfo>();
    for (const s of seats) {
      const hex = COLOR_HEX[s.color] ?? "#888";
      map.set(s.playerNumber, { pn: s.playerNumber, color: s.color, hex, name: s.username });
    }
    return map;
  }, [seats]);

  const legalMoves = useMemo(() => {
    if (!isMyTurn || game.status !== "PLAYING") return [];
    try {
      return legalLudoMoves(state);
    } catch {
      return [];
    }
  }, [state, isMyTurn, game.status]);

  const legalTokens = useMemo(() => new Set(legalMoves.map((m) => m.token)), [legalMoves]);
  const canRoll = isMyTurn && game.status === "PLAYING" && state.phase === "ROLL" && !isActing;
  const activePn = game.status === "PLAYING" ? state.turn : null;
  const overPn = game.status === "FINISHED" ? seatByPn.get(state.done[0] ?? 0) : null;

  const absPos = (abs: number): { r: number; c: number } | null => {
    const cell = ABS_CELLS[abs];
    return cell ? { r: cell[0], c: cell[1] } : null;
  };

  /** Absolute grid position (in units) of a token. */
  const posOf = (pn: number, rel: number, tokenIdx: number) => {
    if (rel === -1) {
      const q = QUAD_CENTERS[pn];
      const [dr, dc] = SOCKETS[tokenIdx % 4];
      return { r: q.r + dr, c: q.c + dc };
    }
    if (rel === LUDO_FINISH) {
      const f = FINISH_CENTERS[pn] ?? FINISH_CENTERS[1];
      return { r: f.r, c: f.c };
    }
    if (rel >= 51) {
      const cell = homeColumnCells(pn).find((h) => h.rel === rel);
      if (cell) return { r: cell.r, c: cell.c };
      return { r: 7, c: 7 };
    }
    const abs = ((pn - 1) * 13 + rel) % 52;
    const pos = absPos(abs);
    if (!pos) return { r: 7, c: 7 };
    return pos;
  };

  const homeCells = useMemo(() => {
    const all: Array<{ pn: number; r: number; c: number; rel: number }> = [];
    for (const pn of seatByPn.keys()) all.push(...homeColumnCells(pn).map((h) => ({ pn, ...h })));
    return all;
  }, [seatByPn]);

  // ---------- token layer ----------
  const tokenElements: ReactNode[] = [];
  state.tokens &&
    Object.entries(state.tokens).forEach(([pnStr, tokenRels]) => {
      const pn = Number(pnStr);
      const seat = seatByPn.get(pn);
      if (!seat) return;
      const hex = seat.hex;
      tokenRels.forEach((rel, idx) => {
        const pos = posOf(pn, rel, idx);
        const legal = legalTokens.has(idx) && state.turn === pn;
        const done = rel === LUDO_FINISH;
        tokenElements.push(
          <button
            key={`${pn}-${idx}`}
            disabled={!legal || isActing}
            onClick={() => act({ action: "move", token: idx })}
            aria-label={`${seat.name} token ${idx + 1}`}
            className={cn(
              "absolute z-20 rounded-full transition-all duration-200",
              legal && "cursor-pointer z-30 animate-pulse",
              !legal && "cursor-default"
            )}
            style={{
              left: `${P(pos.c)}%`,
              top: `${P(pos.r)}%`,
              width: `${P(1) * 0.92}%`,
              height: `${P(1) * 0.92}%`,
              transform: "translate(-50%, -50%)",
              background: `radial-gradient(circle at 32% 28%, ${shade(hex, 38)} 0%, ${hex} 45%, ${shade(hex, -26)} 100%)`,
              border: `2px solid ${done ? alpha("#ffffff", 0.9) : alpha("#ffffff", 0.85)}`,
              boxShadow: legal
                ? `0 0 0 3px rgba(255,255,255,0.85), 0 0 18px 2px ${hex}, 0 3px 6px rgba(0,0,0,0.4)`
                : `0 0 0 ${done ? 2 : 1}px ${alpha(shade(hex, -40), 0.7)}, 0 3px 5px rgba(0,0,0,0.35)`,
            }}
          >
            <span
              className="absolute inset-[18%] rounded-full"
              style={{ background: alpha("#ffffff", 0.18) }}
            />
          </button>
        );
      });
    });

  return (
    <div className="flex w-full flex-col gap-3">
      {/* ============ BOARD ============ */}
      <div className="relative w-full select-none" style={{ aspectRatio: "1 / 1" }}>
        {/* wood surface */}
        <div
          className="absolute inset-0 rounded-2xl"
          style={{
            background: WOOD,
            boxShadow: "inset 0 0 0 4px rgba(60,38,18,0.55), inset 0 0 60px rgba(0,0,0,0.28), 0 18px 40px -12px rgba(0,0,0,0.7)",
          }}
        />

        {/* shared track (52 cells) */}
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
                background: isStart ? "linear-gradient(180deg,#fff7e2,#f1e2bd)" : CREAM,
                border: "1px solid rgba(110,78,40,0.35)",
                boxShadow: safe ? `inset 0 0 0 2px ${alpha("#a9763c", 0.35)}` : undefined,
              }}
            >
              {safe && (
                <span
                  className="absolute inset-0 flex items-center justify-center"
                  style={{ color: "rgba(120,84,40,0.5)" }}
                >
                  <StarGlyph />
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

        {/* home columns (painted per player) */}
        {homeCells.map((h) => {
          const seat = seatByPn.get(h.pn);
          if (!seat) return null;
          const hex = seat.hex;
          return (
            <div
              key={`h${h.pn}-${h.rel}`}
              className="absolute rounded-[2px]"
              style={{
                left: `${P(h.c)}%`,
                top: `${P(h.r)}%`,
                width: `${P(1)}%`,
                height: `${P(1)}%`,
                background: `linear-gradient(145deg, ${hex}F2, ${hex}B8)`,
                border: "1px solid rgba(70,40,10,0.45)",
                backgroundImage: `radial-gradient(${alpha(shade(hex, -34), 0.5)} 1px, transparent 1.6px)`,
                backgroundSize: "7px 7px",
                boxShadow: "inset 0 1px 2px rgba(255,255,255,0.35)",
              }}
            />
          );
        })}

        {/* centre: 4 triangles */}
        <div
          className="absolute"
          style={{
            left: `${P(6)}%`,
            top: `${P(6)}%`,
            width: `${P(3)}%`,
            height: `${P(3)}%`,
          }}
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
              const seat = seatByPn.get(pn);
              const hex = seat?.hex ?? "#cbb493";
              return (
                <polygon
                  key={pn}
                  points={pts}
                  fill={hex}
                  stroke="rgba(60,38,18,0.6)"
                  strokeWidth={0.6}
                />
              );
            })}
          </svg>
          {/* subtle centre medallion */}
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ width: "22%", height: "22%", background: "rgba(70,45,20,0.35)", border: "1px solid rgba(255,255,255,0.4)" }}
          />
        </div>

        {/* corner bases */}
        {[...seatByPn.values()].map((seat) => {
          const q = QUAD_CENTERS[seat.pn];
          const hex = seat.hex;
          const isTurn = activePn === seat.pn;
          const baseSize = 4.6; // diameter in grid cells
          return (
            <div
              key={`b${seat.pn}`}
              className="absolute rounded-full"
              style={{
                left: `${P(q.c)}%`,
                top: `${P(q.r)}%`,
                width: `${P(baseSize)}%`,
                height: `${P(baseSize)}%`,
                transform: "translate(-50%,-50%)",
                background: `radial-gradient(circle at 32% 28%, ${alpha(shade(hex, 30), 0.95)} 0%, ${alpha(hex, 0.85)} 55%, ${alpha(shade(hex, -30), 0.98)} 100%)`,
                border: `3px solid ${alpha(shade(hex, -38), 0.9)}`,
                boxShadow: isTurn
                  ? `0 0 0 3px rgba(255,255,255,0.35), 0 0 26px 4px ${hex}, inset 0 2px 10px rgba(0,0,0,0.3)`
                  : "inset 0 2px 10px rgba(0,0,0,0.3), 0 6px 12px rgba(0,0,0,0.35)",
              }}
            >
              {/* scribble texture */}
              <div
                className="pointer-events-none absolute inset-0 rounded-full opacity-60"
                style={{
                  backgroundImage: `radial-gradient(${alpha(shade(hex, -45), 0.55)} 1px, transparent 1.6px), radial-gradient(${alpha("#ffffff", 0.35)} 1px, transparent 1.6px)`,
                  backgroundSize: "8px 8px, 10px 10px",
                  backgroundPosition: "0 0, 5px 5px",
                }}
              />
              {/* token sockets */}
              {SOCKETS.map(([dr, dc], i) => (
                <div
                  key={i}
                  className="absolute rounded-full"
                  style={{
                    left: `${((baseSize / 2 + dr) / baseSize) * 100}%`,
                    top: `${((baseSize / 2 + dc) / baseSize) * 100}%`,
                    width: `${(1.15 / baseSize) * 100}%`,
                    height: `${(1.15 / baseSize) * 100}%`,
                    transform: "translate(-50%,-50%)",
                    background: "rgba(0,0,0,0.18)",
                    border: `2px solid ${alpha("#ffffff", 0.5)}`,
                    boxShadow: "inset 0 2px 4px rgba(0,0,0,0.35)",
                  }}
                />
              ))}
            </div>
          );
        })}

        {/* tokens */}
        {tokenElements}

        {/* die overlay */}
        {state.die !== null && state.die !== undefined && (
          <div
            className="pointer-events-none absolute z-30"
            style={{ right: `${P(0.2)}%`, top: `${P(0.2)}%`, transform: "rotate(14deg)" }}
          >
            <Die value={state.die} color={seatByPn.get(state.turn)?.hex ?? "#2563eb"} />
          </div>
        )}
      </div>

      {/* ============ CONTROLS ============ */}
      <div className="flex flex-col items-center gap-3">
        {/* turn chips */}
        <div className="flex w-full items-center justify-center gap-2 overflow-x-auto rounded-xl border border-white/10 bg-white/5 px-3 py-2">
          {[...seatByPn.values()].map((seat) => {
            const turn = activePn === seat.pn;
            const won = seat.pn === overPn?.pn;
            return (
              <div
                key={seat.pn}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold uppercase tracking-wide transition-all",
                  turn ? "bg-white/15 text-white" : "text-slate-400 opacity-70"
                )}
                style={turn ? { boxShadow: `0 0 12px ${alpha(seat.hex, 0.7)}` } : undefined}
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: seat.hex, boxShadow: `0 0 6px ${seat.hex}` }} />
                <span className="max-w-[90px] truncate">{seat.name}</span>
                {won && <span>👑</span>}
                {seat.pn === mySeatNumber && <span className="text-[9px] text-cyan-300">(you)</span>}
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            size="lg"
            loading={isActing}
            disabled={!canRoll}
            onClick={() => act({ action: "roll" })}
            className="min-w-[140px] italic font-black uppercase tracking-widest"
          >
            🎲 Roll
          </Button>
        </div>
        {game.status === "PLAYING" && !isMyTurn && (
          <p className="text-xs uppercase tracking-widest text-slate-500">Waiting for the current player…</p>
        )}
        {game.status === "PLAYING" && isMyTurn && state.phase === "ROLL" && (
          <p className="text-xs uppercase tracking-widest text-cyan-300">Your turn — roll the dice</p>
        )}
        {game.status === "PLAYING" && isMyTurn && state.phase === "MOVE" && (
          <p className="text-xs uppercase tracking-widest text-amber-300">Tap one of your glowing tokens to move it</p>
        )}
      </div>
    </div>
  );
}

function StarGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-[55%] w-[55%]">
      <path
        d="M12 2l2.4 6.9 7.3.5-5.7 4.5 1.9 7-5.9-4.2-5.9 4.2 1.9-7L2.3 9.4l7.3-.5z"
        fill="currentColor"
      />
    </svg>
  );
}

function Die({ value, color }: { value: number; color: string }) {
  const dots: number[][] = [[], [4], [0, 8], [0, 4, 8], [0, 2, 6, 8], [0, 2, 4, 6, 8], [0, 2, 3, 5, 6, 8]];
  const list = dots[value] ?? [];
  const dark = shade(color, -30);
  return (
    <div
      className="relative rounded-[18%] p-[9%] shadow-2xl"
      style={{
        width: "64px",
        height: "64px",
        background: `linear-gradient(145deg, ${shade(color, 14)} 0%, ${color} 55%, ${dark} 100%)`,
        border: `2px solid ${shade(color, -45)}`,
        boxShadow: `0 10px 18px rgba(0,0,0,0.5), inset 0 -4px 6px rgba(0,0,0,0.25), inset 0 3px 5px rgba(255,255,255,0.4)`,
      }}
    >
      <div className="grid h-full w-full grid-cols-3 grid-rows-3 gap-[6%]">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="flex items-center justify-center">
            {list.includes(i) && (
              <span
                className="block aspect-square w-[86%] rounded-full"
                style={{ background: "#fff", boxShadow: "inset 0 -1px 2px rgba(0,0,0,0.3)" }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
