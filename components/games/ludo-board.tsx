"use client";

import * as React from "react";
import type { ReactNode } from "react";
import type { GameSnapshot } from "@/lib/games/types";
import { COLOR_HEX } from "@/lib/games/types";
import { cn } from "@/lib/utils";
import { legalLudoMoves, ludoSafeCells, LUDO_FINISH } from "@/lib/games/ludo/engine";
import type { LudoState } from "@/lib/games/ludo/engine";

/* =====================================================================
 * DARKNOTE Ludo board — polished gameplay client.
 *
 * - Logical grid of 15x15 cells; every cell centre is derived from the
 *   grid, so pieces scale with the board on any screen.
 * - Server-confirmed moves (from the snapshot) are animated box-by-box;
 *   rolls spin the 3D dice until it settles on the authoritative result.
 * - Input is locked while dice/pieces animate so rapid taps can never
 *   cause double rolls or conflicting moves.
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
              background: isStart ? "linear-gradient(180deg,#fff7e2,#f1e2bd)" : CREAM,
              border: "1px solid rgba(110,78,40,0.35)",
              boxShadow: safe ? `inset 0 0 0 2px ${alpha("#a9763c", 0.35)}` : undefined,
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
              background: `linear-gradient(145deg, ${hex}F2, ${hex}B8)`,
              border: "1px solid rgba(70,40,10,0.45)",
              backgroundImage: `radial-gradient(${alpha(shade(hex, -34), 0.5)} 1px, transparent 1.6px)`,
              backgroundSize: "7px 7px",
              boxShadow: "inset 0 1px 2px rgba(255,255,255,0.35)",
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

      {/* corner bases + sockets */}
      {[...seats.values()].map((seat) => {
        const q = QUAD_CENTERS[seat.pn];
        const hex = seat.color;
        const isTurn = activePn === seat.pn;
        const baseSize = 4.6;
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
            <div
              className="pointer-events-none absolute inset-0 rounded-full opacity-60"
              style={{
                backgroundImage: `radial-gradient(${alpha(shade(hex, -45), 0.55)} 1px, transparent 1.6px), radial-gradient(${alpha("#ffffff", 0.35)} 1px, transparent 1.6px)`,
                backgroundSize: "8px 8px, 10px 10px",
                backgroundPosition: "0 0, 5px 5px",
              }}
            />
          </div>
        );
      })}

      {/* token sockets inside the bases */}
      {[...seats.values()].map((seat) => {
        const q = QUAD_CENTERS[seat.pn];
        return SOCKET_OFFS.map(([dr, dc], i) => (
          <div
            key={`s${seat.pn}-${i}`}
            className="pointer-events-none absolute rounded-full"
            style={{
              left: `${P(q.c + dr)}%`,
              top: `${P(q.r + dc)}%`,
              width: `${P(1.15)}%`,
              height: `${P(1.15)}%`,
              transform: "translate(-50%,-50%)",
              background: "rgba(0,0,0,0.18)",
              border: `2px solid ${alpha("#ffffff", 0.5)}`,
              boxShadow: "inset 0 2px 4px rgba(0,0,0,0.35)",
            }}
          />
        ));
      })}
    </>
  );
});

/* ------------------------------ 3D dice ------------------------------ */

const FACE_ORIENT: Record<number, [number, number]> = {
  1: [0, 0],
  2: [90, 0],
  3: [0, -90],
  4: [0, 90],
  5: [-90, 0],
  6: [180, 0],
};

const FACE_DOTS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

function DiceCube({
  sizePx,
  face,
  spinKey,
  target,
  interactive,
  dim,
  onRoll,
}: {
  sizePx: number;
  face: number | null;
  spinKey: number;
  target: number | null;
  interactive: boolean;
  dim: boolean;
  onRoll: () => void;
}) {
  const cubeRef = React.useRef<HTMLDivElement>(null);
  const shadowRef = React.useRef<HTMLDivElement>(null);
  const curRef = React.useRef<[number, number]>([0, 0]);
  const pressRef = React.useRef<{ x: number; y: number } | null>(null);
  const swipeRef = React.useRef<{ dx: number; dy: number } | null>(null);
  const [pressed, setPressed] = React.useState(false);
  const s = sizePx || 96;
  const h = s / 2;

  const faceNodes: ReactNode[] = [];
  const defs: Array<[string, string, number]> = [
    ["front", "", 1],
    ["back", "rotateY(180deg)", 6],
    ["right", "rotateY(90deg)", 3],
    ["left", "rotateY(-90deg)", 4],
    ["top", "rotateX(90deg)", 2],
    ["bottom", "rotateX(-90deg)", 5],
  ];
  const faceRadius = Math.max(6, Math.round(s * 0.13));
  for (const [name, rot, num] of defs) {
    const dots = FACE_DOTS[num] ?? [];
    faceNodes.push(
      <div
        key={name}
        className="absolute"
        style={{
          inset: 0,
          transform: `${rot} translateZ(${h}px)`,
          borderRadius: faceRadius,
          background:
            "radial-gradient(circle at 30% 24%, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0) 48%), linear-gradient(160deg,#ffffff 0%,#f8f8fc 50%,#e7e7f0 100%)",
          border: "1px solid rgba(35,38,58,0.14)",
          boxShadow: "inset 0 -3px 6px rgba(130,135,160,0.22), inset 0 2px 3px rgba(255,255,255,0.9)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        <div className="grid h-full w-full grid-cols-3 grid-rows-3 p-[13%]">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="flex items-center justify-center">
              {dots.includes(i) && (
                <span
                  className="block aspect-square w-[86%] rounded-full"
                  style={{
                    background: "radial-gradient(circle at 38% 32%, #43485a 0%, #1c1f29 62%, #101219 100%)",
                    boxShadow: "inset 0 1px 1px rgba(255,255,255,0.28), 0 1px 2px rgba(0,0,0,0.35)",
                  }}
                />
              )}
            </div>
          ))}
        </div>
        {/* glossy sheen */}
        <span
          className="pointer-events-none absolute inset-0"
          style={{
            borderRadius: faceRadius,
            background:
              "linear-gradient(115deg, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.12) 26%, rgba(255,255,255,0) 44%), linear-gradient(295deg, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0) 30%)",
          }}
        />
      </div>
    );
  }

  /**
   * Thrown-dice physics roll — lightweight rAF simulation, GPU-only transforms.
   *
   * The die LIFTS, is THROWN slightly forward/up, TUMBLES fast on X/Y/Z,
   * BOUNCES on the floor and against the bounds of its small allowed area,
   * then decelerates and settles EXACTLY on the server-confirmed face.
   * No WebGL / physics libraries: two DOM elements (cube + ground shadow),
   * ideal for low-end phones.
   */
  React.useEffect(() => {
    const el = cubeRef.current;
    const sh = shadowRef.current;
    if (!el || spinKey === 0) return;
    const [ax, ay] = FACE_ORIENT[target ?? 1] ?? [0, 0];
    const [rx0, ry0] = curRef.current;

    const norm = (v: number) => ((v % 360) + 360) % 360;
    const dir = (delta: number, dirSign: number) =>
      dirSign > 0 ? (delta >= 0 ? delta : delta + 360) : delta <= 0 ? delta : delta - 360;
    const dx = norm(ax) - norm(rx0);
    const dy = norm(ay) - norm(ry0);
    const dxS = ((dx + 540) % 360) - 180; // shortest signed delta to the target face
    const dyS = ((dy + 540) % 360) - 180;
    const dirX = dxS >= 0 ? 1 : -1;
    const dirY = dyS >= 0 ? 1 : -1;
    const totalX = dir(dxS, dirX) + 360 * (2 + Math.floor(Math.random() * 3)); // 2-4 full tumbles
    const totalY = dir(dyS, dirY) + 360 * (1 + Math.floor(Math.random() * 2));

    // Rotation curve (fast start, natural deceleration) then hold the exact face.
    const angDur = 760 + Math.random() * 150;
    const tAng0 = performance.now();

    // ---------- positional physics (px, local to the die area) ----------
    const sc = s / 96;
    const G = 1800 * sc; // gravity
    let x = 0; // starts from the resting position (centre of its area)
    let y = 0; // 0 = resting on the board, negative = up

    // Swipe (or tap) sets the throw direction & power.
    const sw = swipeRef.current;
    const hasSwipe = sw !== null && (Math.abs(sw.dx) > 6 || Math.abs(sw.dy) > 6);
    const dirSign = hasSwipe ? Math.sign(sw.dx) || 1 : Math.random() < 0.5 ? 1 : -1;
    const power = hasSwipe ? Math.min(1.5, 0.45 + Math.abs(sw.dx) / 240) : 0.8 + Math.random() * 0.45;
    const upBoost = hasSwipe && sw.dy < -28 ? 1.2 : 1;
    // A realistic toss: apex ~0.3 of the die size, slide of roughly 1 die width.
    let vy = -(2.5 + Math.random() * 0.8) * s * upBoost; // lift off the board
    let vx = dirSign * power * s * (0.55 + Math.random() * 0.35); // slide in the swipe direction
    const wall = s * 0.5; // compact controlled area — bounces back, never leaves
    let bounces = 0;
    let resting = false;
    let raf = 0;
    let prev = performance.now();

    const frame = (now: number) => {
      const dt = Math.min(0.033, (now - prev) / 1000);
      prev = now;

      // integrate position
      vy += G * dt;
      y += vy * dt;
      x += vx * dt;

      // wall bounce — the die stays inside its area
      if (x > wall) { x = wall; vx = -vx * 0.55; }
      else if (x < -wall) { x = -wall; vx = -vx * 0.55; }

      // floor bounce with restitution, then rest
      if (y >= 0) {
        y = 0;
        if (!resting && bounces < 3 && vy > 90 * sc) {
          vy = -vy * 0.42; // small believable bounce
          vx *= 0.72;
          bounces++;
        } else {
          vy = 0;
          if (!resting) {
            resting = true;
            vx = 0;
          }
        }
      } else {
        vx *= Math.pow(0.5, dt); // air drag on the slide
      }

      // board friction while sliding on the surface
      if (y === 0 && !resting) vx *= Math.pow(0.34, dt);

      // gentle roll back to the exact resting spot once the toss is done
      if (resting && Math.abs(x) > 0.8) {
        x -= Math.sign(x) * Math.min(Math.abs(x), 340 * sc * dt);
      }

      // rotation: real 3D tumble (X+Y big turns) + decaying multi-axis wobble (Z too)
      const ta = Math.min(1, (now - tAng0) / angDur);
      const ease = 1 - Math.pow(1 - ta, 3.1);
      const wob = Math.sin(ta * Math.PI * 7.2) * Math.max(0, 1 - ta * 1.9) * 26;
      const rx = rx0 + totalX * ease;
      const ry = ry0 + totalY * ease;

      // soft ground shadow reacts to height
      if (sh) {
        const lift = Math.max(0, Math.min(1, -y / (s * 0.95)));
        const shScale = 1 - 0.24 * lift;
        sh.style.opacity = String(0.45 - 0.26 * lift);
        sh.style.transform = `translate(-50%, 0) translateX(${x.toFixed(1)}px) scale(${shScale.toFixed(3)})`;
      }

      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) rotateX(${(rx + wob * 0.85).toFixed(2)}deg) rotateY(${(ry - wob * 0.5).toFixed(2)}deg) rotateZ(${(wob * 0.45).toFixed(2)}deg)`;

      if (ta < 1 || !resting || Math.abs(x) > 0.8) {
        raf = requestAnimationFrame(frame);
      } else {
        // settle exactly on the server face, back at the resting position
        const fx = rx0 + totalX;
        const fy = ry0 + totalY;
        curRef.current = [fx, fy];
        el.style.transform = `translate3d(0, 0, 0) rotateX(${fx}deg) rotateY(${fy}deg)`;
        if (sh) {
          sh.style.opacity = "0.45";
          sh.style.transform = "translate(-50%, 0) scale(1)";
        }
      }
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      el.style.transform = `translate3d(0,0,0) rotateX(${curRef.current[0]}deg) rotateY(${curRef.current[1]}deg)`;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinKey]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!interactive) return;
    pressRef.current = { x: e.clientX, y: e.clientY };
    setPressed(true);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    setPressed(false);
    if (!interactive || !pressRef.current) return;
    const dx = e.clientX - pressRef.current.x;
    const dy = e.clientY - pressRef.current.y;
    pressRef.current = null;
    // Remember the gesture so the throw follows its direction & power.
    swipeRef.current = { dx, dy };
    // A tap OR a swipe (any direction) throws the die.
    if (Math.hypot(dx, dy) < 120) onRoll();
  };
  const onPointerCancel = () => {
    setPressed(false);
    pressRef.current = null;
  };

  const idle = !dim && spinKey === 0 && face !== null;

  return (
    <div
      className={cn(
        "relative transition-transform duration-100",
        !interactive && "pointer-events-none",
        pressed && interactive && "scale-90"
      )}
      style={{ width: s, height: s, perspective: s * 2.8 }}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      role={interactive ? "button" : undefined}
      aria-label="Roll the dice"
    >
      {/* soft moving ground shadow */}
      <div
        ref={shadowRef}
        className="pointer-events-none absolute rounded-[50%]"
        style={{
          left: "50%",
          top: "86%",
          width: s * 0.96,
          height: s * 0.22,
          transform: "translate(-50%, 0)",
          opacity: dim ? 0.2 : 0.42,
          background: "radial-gradient(ellipse at center, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0) 70%)",
          filter: "blur(2px)",
        }}
      />

      {/* idle float wrapper (only when waiting, never during a roll) */}
      <div
        className={cn("absolute inset-0", idle && "die-float", dim && spinKey === 0 && "opacity-70")}
        style={{ transition: "opacity .25s" }}
      >
        <div
          ref={cubeRef}
          className="absolute"
          style={{
            width: s,
            height: s,
            left: "50%",
            top: "50%",
            marginLeft: -s / 2,
            marginTop: -s / 2,
            transformStyle: "preserve-3d",
            transform: `rotateX(${curRef.current[0]}deg) rotateY(${curRef.current[1]}deg)`,
          }}
        >
          {faceNodes}
          {face === null && (
            <div
              className="absolute flex items-center justify-center font-black"
              style={{
                inset: 0,
                transform: `translateZ(${h}px)`,
                borderRadius: Math.max(6, Math.round(s * 0.13)),
                background:
                  "radial-gradient(circle at 30% 24%, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0) 48%), linear-gradient(160deg,#ffffff 0%,#f8f8fc 50%,#e7e7f0 100%)",
                border: "1px solid rgba(35,38,58,0.14)",
                boxShadow: "inset 0 -3px 6px rgba(130,135,160,0.22)",
                fontSize: s * 0.5,
                color: "#34384a",
              }}
            >
              ?
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

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
  const [die, setDie] = React.useState<{ face: number | null; spinKey: number; target: number | null }>({
    face: null,
    spinKey: 0,
    target: null,
  });

  const queueRef = React.useRef<Array<Record<string, unknown>>>([]);
  const lastAppliedRef = React.useRef(0);
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

  const homeRelCells = React.useMemo(() => {
    const all: Array<{ pn: number; r: number; c: number; rel: number }> = [];
    for (const pn of seatByPn.keys()) all.push(...homeColumnCells(pn).map((h) => ({ pn, ...h })));
    return all;
  }, [seatByPn]);

  const cellPx = boardW / GRID;
  const tokenPx = cellPx * 0.92;
  const homeTokenPx = cellPx * 0.8;
  const dieSizePx = Math.min(Math.max(boardW * 0.135, 60), 104);

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
    !rollPendingRef.current;

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

  // When reconnecting or coming back mid-game, show the authoritative die face.
  React.useEffect(() => {
    if (!busyRef.current && die.target === null && die.face === null && state.die != null) {
      setDie((d) => ({ ...d, face: state.die as number }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.die, die.face, die.target]);

  // ---------- consume server-confirmed moves into the animation queue ----------
  const enqueueNewMoves = React.useCallback(() => {
    for (const m of snapshot.recentMoves) {
      if (m.moveNumber <= lastAppliedRef.current) continue;
      const md = (m.moveData ?? {}) as Record<string, unknown>;
      if (md.kind === "ludo-roll") {
        queueRef.current.push({ kind: "roll", die: md.die, moveNumber: m.moveNumber });
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
            setDie((d) => ({ face: d.face, spinKey: d.spinKey + 1, target: dieVal }));
            await sleep(1290); // physics roll duration (1150-1310ms) + settle
            setDie((d) => ({ face: dieVal, spinKey: d.spinKey, target: null }));
            await sleep(90);
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
                setFx((f) => ({ ...f, [key]: "land" }));
                window.setTimeout(() => setFx((f) => ({ ...f, [key]: undefined })), 480);
                await sleep(300);
              } else {
                await sleep(175);
              }
            }
            // captured tokens fly back to their home socket
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
      lastAppliedRef.current = snapshot.recentMoves.reduce(
        (m, x) => Math.max(m, x.moveNumber),
        0
      );
      queueRef.current = [];
      return;
    }
    enqueueNewMoves();
    void pump();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot.recentMoves]);

  // ---------- interactions ----------
  const doRoll = React.useCallback(async () => {
    if (!canRoll || busyRef.current || rollPendingRef.current) return;
    rollPendingRef.current = true;
    try {
      await act({ action: "roll" });
      // server confirms; the roll event drives the dice animation
    } catch {
      rollPendingRef.current = false;
    }
    // release happens in pump() once the confirm event has been animated
  }, [act, canRoll]);

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
        const x = pos.c * cell;
        const y = pos.r * cell;
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
              background: `radial-gradient(circle at 32% 28%, ${shade(seat.color, 38)} 0%, ${seat.color} 45%, ${shade(seat.color, -26)} 100%)`,
              border: `2px solid rgba(255,255,255,0.85)`,
              boxShadow: legal
                ? `0 0 0 3px rgba(255,255,255,0.9), 0 0 16px 2px ${seat.color}, 0 3px 6px rgba(0,0,0,0.4)`
                : `0 0 0 1px ${alpha(shade(seat.color, -40), 0.7)}, 0 3px 5px rgba(0,0,0,0.35)`,
              touchAction: "manipulation",
            }}
          >
            <span
              className={cn(
                "pointer-events-none absolute inset-[16%] rounded-full transition-none",
                effect === "land" && "fx-land",
                effect === "capture" && "fx-capture"
              )}
              style={{
                background:
                  effect === "capture" ? "rgba(255,255,255,0.05)" : alpha("#ffffff", 0.16),
              }}
            />
          </button>
        );
      });
    }
  }

  const statusOver = ["FINISHED", "DRAW", "CANCELLED"].includes(game.status);
  const showDie = !statusOver && !!seatByPn.size;
  const hint = !isMyTurn
    ? activePn !== null
      ? `${seatByPn.get(activePn)?.name ?? "Player"} is thinking…`
      : ""
    : state.phase === "ROLL"
      ? "Tap or swipe the dice to roll"
      : legalTokens.size > 0
        ? "Tap a glowing token to move it"
        : "Rolling…";

  const hintTone =
    !isMyTurn ? "text-slate-400" : state.phase === "ROLL" ? "text-cyan-300" : "text-amber-300";

  return (
    <div className="flex w-full flex-col gap-3">
      {/* board */}
      <div
        ref={boardRef}
        className="relative w-full select-none"
        style={{ aspectRatio: "1 / 1", touchAction: "manipulation" }}
      >
        <div
          className="absolute inset-0 rounded-2xl"
          style={{
            background: WOOD,
            boxShadow:
              "inset 0 0 0 4px rgba(60,38,18,0.55), inset 0 0 60px rgba(0,0,0,0.28), 0 18px 40px -12px rgba(0,0,0,0.7)",
          }}
        />

        <StaticLayers seats={seatByPn} activePn={activePn} homeRelCells={homeRelCells} />

        {tokenEls}

        {/* on-board dice */}
        {showDie && (
          <div
            className={cn(
              "absolute z-50",
              !canRoll && "cursor-not-allowed",
              canRoll && "die-pulse"
            )}
            style={{ left: "50%", top: "50%", transform: "translate(-50%, -50%)" }}
          >
            <DiceCube
              sizePx={dieSizePx}
              face={die.face}
              spinKey={die.spinKey}
              target={die.target}
              interactive={canRoll}
              dim={!canRoll && die.target === null}
              onRoll={() => void doRoll()}
            />
          </div>
        )}
      </div>

      {/* status row */}
      <div className="flex items-center justify-center gap-2 px-1">
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
        @keyframes diePulse {
          0%, 100% { filter: drop-shadow(0 0 2px rgba(255,255,255,0)); }
          50% { filter: drop-shadow(0 0 14px rgba(139,92,246,0.85)); }
        }
        .die-pulse { animation: diePulse 1.6s ease-in-out infinite; }
        @keyframes dieFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
        .die-float { animation: dieFloat 2.6s ease-in-out infinite; }
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
      `}</style>
    </div>
  );
}
