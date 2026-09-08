"use client";

/**
 * LudoPhysicalDice — a REAL 3D physics dice that lives ON the Ludo board.
 *
 * - cannon-es rigid body (box) on a ground plane inside board walls:
 *   gravity toss, friction rolling, restitution bounces, natural deceleration
 *   and settling — no keyframe/linear faking.
 * - Swipe directly on the die: the swipe vector sets travel direction, throw
 *   strength, rotation direction & spin speed.
 * - The rolled VALUE is the physical top face (the face pointing at the
 *   viewer once the cube comes to rest). Nothing is randomly generated.
 * - The dice keeps the position where it landed. `snapTo(pose)` restores an
 *   authoritative pose; `replayTo(pose)` tumbles to a server-confirmed pose
 *   for remote/AI rolls so every client converges on the SAME final state.
 * - Colour: the whole die (faces, aura, trail, ready-glow) tints to the seat
 *   colour of the player whose turn it is — pass `color` from the board.
 *
 * Frame-rate cost: physics + DOM style writes run in ONE rAF loop on refs —
 * zero React re-renders per frame. Everything is cleaned up on unmount.
 */

import * as React from "react";
import * as CANNON from "cannon-es";
import type { LudoDicePose } from "@/lib/games/ludo/dice";
import {
  AXIS_FACES,
  CSS_FACES,
  quatMul,
  quatConj,
  normalizeQuat,
  topFaceOf,
} from "@/lib/games/ludo/dice";

export interface PhysicsDiceHandle {
  /** Tumble from the current resting pose to a server-confirmed pose. */
  replayTo(target: LudoDicePose): Promise<void>;
  /** Instantly place the die at an authoritative pose (init / reconnect). */
  snapTo(pose: LudoDicePose): void;
}

interface PhysicsDiceProps {
  /** Board square size in px — defines walls & pose mapping. */
  boardPx: number;
  /** Dice size in px. */
  sizePx: number;
  /** Authoritative pose to rest at when idle. */
  pose: LudoDicePose;
  /** Current player may swipe this die. */
  canRoll: boolean;
  /** Seat colour (hex) of the player whose turn it is — the die theme
   *  (faces, aura, trail and ready-glow) tints to this colour. */
  color?: string;
  /** A local physics roll started (parent can flash the "rolling" state). */
  onRollStart?: () => void;
  /** A local physics roll settled — pose + physical face value. */
  onSettled?: (pose: LudoDicePose, value: number) => void;
  /** Ready-to-roll glow pulse. */
  glow?: boolean;
}

/* ----------------------------- palette ----------------------------- */

const DEFAULT_DIE_COLOR = "#e11d3c";

function shade(hex: string, pct: number): string {
  const n = parseInt(hex.slice(1), 16);
  const amt = Math.round(2.55 * pct);
  const clamp = (v: number) => Math.min(255, Math.max(0, v));
  const r = clamp((n >> 16) + amt);
  const g = clamp(((n >> 8) & 0xff) + amt);
  const b = clamp((n & 0xff) + amt);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

function rgbCss(rgb: [number, number, number]): string {
  return `${rgb[0]}, ${rgb[1]}, ${rgb[2]}`;
}

/** ~perceived lightness (0..255) to pick dark ink on light faces (yellow). */
function luminance(rgb: [number, number, number]): number {
  return 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2];
}

interface DieTheme {
  /** Face gradient stops — light catch / base / deep shaded edge. */
  light: string;
  base: string;
  deep: string;
  /** Face border + inner shadow (derived from the deep tone). */
  border: string;
  insetA: string;
  insetB: string;
  /** Ink (value numeral) & its depth shadow. */
  ink: string;
  inkShadow: string;
  /** Accent glows as rgb-triplets for aura/trail/ready CSS. */
  rgb: string;
  shadowBase: string;
}

function buildTheme(baseHex: string): DieTheme {
  const base = /^#[0-9a-fA-F]{6}$/.test(baseHex) ? baseHex : DEFAULT_DIE_COLOR;
  const light = shade(base, 30);
  const deep = shade(base, -38);
  const rgb = hexToRgb(base);
  const useDarkInk = luminance(rgb) > 170; // yellow / very light seats
  return {
    light,
    base,
    deep,
    border: `rgba(${rgbCss(hexToRgb(deep))}, 0.85)`,
    insetA: `rgba(${rgbCss(hexToRgb(deep))}, 0.55)`,
    insetB: "rgba(255,255,255,0.5)",
    ink: useDarkInk ? "#33250a" : "#ffffff",
    inkShadow: useDarkInk ? "0 1px 0 rgba(255,255,255,0.35), 0 2px 6px rgba(90,60,0,0.25)" : "0 2px 4px rgba(0,0,0,0.35), 0 1px 0 rgba(255,255,255,0.25)",
    rgb: rgbCss(rgb),
    shadowBase: `rgba(${rgbCss(hexToRgb(deep))}, 0.4)`,
  };
}

/* --------------------------- math helpers --------------------------- */

// CSS axes: +X right, +Y down-screen, +Z toward viewer. Cannon axes: x=css x,
// y=css z (up/board normal), z=css -y. The frame change is a css rotateX(+90).
const FRAME_Q = { qx: Math.SQRT1_2, qy: 0, qz: 0, qw: Math.SQRT1_2 };
const FRAME_Q_CONJ = quatConj(FRAME_Q);

function qFromCannon(q: { x: number; y: number; z: number; w: number }) {
  return quatMul(quatMul(FRAME_Q, { qx: q.x, qy: q.y, qz: q.z, qw: q.w }), FRAME_Q_CONJ);
}
function qToCannon(q: { qx: number; qy: number; qz: number; qw: number }) {
  const c = quatMul(quatMul(FRAME_Q_CONJ, q), FRAME_Q);
  return { x: c.qx, y: c.qy, z: c.qz, w: c.qw };
}

/** Quaternion -> CSS matrix3d (column-major) string. */
function cssMatrix(q: { qx: number; qy: number; qz: number; qw: number }): string {
  const { qx, qy, qz, qw } = q;
  const x2 = qx + qx, y2 = qy + qy, z2 = qz + qz;
  const xx = qx * x2, xy = qx * y2, xz = qx * z2;
  const yy = qy * y2, yz = qy * z2, zz = qz * z2;
  const wx = qw * x2, wy = qw * y2, wz = qw * z2;
  // prettier-ignore
  return `matrix3d(${[
    1 - (yy + zz), xy + wz, xz - wy, 0,
    xy - wz, 1 - (xx + zz), yz + wx, 0,
    xz + wy, yz - wx, 1 - (xx + yy), 0,
    0, 0, 0, 1,
  ].join(",")})`;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

/** Shortest-path slerp (assumes normalised, not anti-parallel). */
function slerp(
  a: { qx: number; qy: number; qz: number; qw: number },
  b: { qx: number; qy: number; qz: number; qw: number },
  t: number
) {
  let { qx, qy, qz, qw } = b;
  let dot = a.qx * qx + a.qy * qy + a.qz * qz + a.qw * qw;
  if (dot < 0) {
    qx = -qx; qy = -qy; qz = -qz; qw = -qw;
    dot = -dot;
  }
  if (dot > 0.9995) {
    return {
      qx: a.qx + (qx - a.qx) * t,
      qy: a.qy + (qy - a.qy) * t,
      qz: a.qz + (qz - a.qz) * t,
      qw: a.qw + (qw - a.qw) * t,
    };
  }
  const th0 = Math.acos(dot);
  const th = th0 * t;
  const sinTh = Math.sin(th);
  const sinTh0 = Math.sin(th0);
  const sa = (Math.sin(th0 - th) / sinTh0) * a.qw + (sinTh / sinTh0) * qw;
  const sb = (Math.sin(th0 - th) / sinTh0) * a.qx + (sinTh / sinTh0) * qx;
  const sc = (Math.sin(th0 - th) / sinTh0) * a.qy + (sinTh / sinTh0) * qy;
  const sd = (Math.sin(th0 - th) / sinTh0) * a.qz + (sinTh / sinTh0) * qz;
  return { qw: sa, qx: sb, qy: sc, qz: sd };
}

/* --------------------------- face lookup --------------------------- */

function flatPoseFor(q: { qx: number; qy: number; qz: number; qw: number }, yawRad: number) {
  // Rotate so the current best face points exactly +Z; keep yaw around +Z.
  const value = topFaceOf(q);
  const face = AXIS_FACES.find((f) => f.value === value)?.axis ?? [0, 0, 1];
  const up: [number, number, number] = [0, 0, 1];
  const dot = face[2];
  let align: { qx: number; qy: number; qz: number; qw: number };
  if (dot > 0.9999) {
    align = { qx: 0, qy: 0, qz: 0, qw: 1 };
  } else {
    const ax: [number, number, number] =
      dot < -0.9999
        ? [1, 0, 0]
        : [
            face[1] * up[2] - face[2] * up[1],
            face[2] * up[0] - face[0] * up[2],
            face[0] * up[1] - face[1] * up[0],
          ];
    const alen = Math.hypot(ax[0], ax[1], ax[2]) || 1;
    const ang = Math.acos(clamp(dot, -1, 1));
    const s = Math.sin(ang / 2);
    align = { qx: (ax[0] / alen) * s, qy: (ax[1] / alen) * s, qz: (ax[2] / alen) * s, qw: Math.cos(ang / 2) };
  }
  const roll = axisAngle(up, yawRad);
  const out = quatMul(roll, align);
  normalizeQuat(out);
  return { q: out, value };
}

function axisAngle(axis: [number, number, number], ang: number) {
  const s = Math.sin(ang / 2);
  return { qx: axis[0] * s, qy: axis[1] * s, qz: axis[2] * s, qw: Math.cos(ang / 2) };
}

/* --------------------------- component --------------------------- */

export const LudoPhysicalDice = React.forwardRef<PhysicsDiceHandle, PhysicsDiceProps>(
  function LudoPhysicalDice({ boardPx, sizePx, pose, canRoll, color, onRollStart, onSettled, glow }, ref) {
    const s = sizePx || 64;
    const h = s / 2;

    const rootRef = React.useRef<HTMLDivElement>(null);
    const groupRef = React.useRef<HTMLDivElement>(null);
    const cubeRef = React.useRef<HTMLDivElement>(null);
    const shadowRef = React.useRef<HTMLDivElement>(null);
    const auraRef = React.useRef<HTMLDivElement>(null);
    const trailRef = React.useRef<HTMLDivElement>(null);

    const worldRef = React.useRef<CANNON.World | null>(null);
    const bodyRef = React.useRef<CANNON.Body | null>(null);
    const dieMatRef = React.useRef<CANNON.Material | null>(null);
    const wallBodiesRef = React.useRef<CANNON.Body[]>([]);

    const busyRef = React.useRef(false);
    const modeRef = React.useRef<"idle" | "physics" | "replay" | "level">("idle");
    const rafRef = React.useRef(0);
    const poseRef = React.useRef<LudoDicePose>({ ...pose });
    const pressedRef = React.useRef(false);
    const gestureRef = React.useRef<{
      sx: number; sy: number; cx: number; cy: number; t0: number;
      px: number; py: number; pt: number; vx: number; vy: number;
    } | null>(null);
    const onRollStartRef = React.useRef(onRollStart);
    const onSettledRef = React.useRef(onSettled);
    onRollStartRef.current = onRollStart;
    onSettledRef.current = onSettled;

    /* ---------------- per-player colour theme ---------------- */
    // The die tints to the seat colour of the player whose turn it is.
    const theme = React.useMemo(() => buildTheme(color ?? DEFAULT_DIE_COLOR), [color]);

    // Brief brightness pulse whenever the owner colour changes so the swap
    // reads as an intentional "now it's X's die" moment.
    const recolorTimerRef = React.useRef<number | null>(null);
    React.useEffect(() => {
      const el = cubeRef.current;
      if (!el) return;
      el.classList.remove("ludo-die-recolor");
      void el.getBoundingClientRect(); // restart the animation
      el.classList.add("ludo-die-recolor");
      if (recolorTimerRef.current !== null) window.clearTimeout(recolorTimerRef.current);
      recolorTimerRef.current = window.setTimeout(() => {
        el.classList.remove("ludo-die-recolor");
        recolorTimerRef.current = null;
      }, 640);
      return () => {
        if (recolorTimerRef.current !== null) window.clearTimeout(recolorTimerRef.current);
        recolorTimerRef.current = null;
      };
    }, [color]);

    /* ---------------- geometry helpers ---------------- */
    const pxToUnit = 1 / Math.max(1, s);
    // Walls clamp the die CENTRE so the cube always stays fully on the board.
    const marginPx = Math.max(6, boardPx * 0.05);
    const allowPx = Math.max(0, boardPx / 2 - marginPx - s / 2);

    const resetWorldGeometry = React.useCallback(() => {
      const world = worldRef.current;
      if (!world) return;
      // Ground plane (cannon plane normal is +Z; rotate to +Y).
      if (world.bodies.length === 0) {
        const ground = new CANNON.Body({ mass: 0, material: dieMatRef.current ?? undefined });
        ground.addShape(new CANNON.Plane());
        ground.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
        world.addBody(ground);
      }
      // Perimeter walls — rebuilt when the board is resized.
      for (const w of wallBodiesRef.current) world.removeBody(w);
      wallBodiesRef.current = [];
      const half = allowPx * pxToUnit; // die-centre range in die units
      const thick = 2;
      const wallMat = dieMatRef.current ?? undefined;
      const makeWall = (px: number, py: number, pz: number, hx: number, hy: number, hz: number) => {
        const b = new CANNON.Body({ mass: 0, material: wallMat });
        b.addShape(new CANNON.Box(new CANNON.Vec3(hx, hy, hz)));
        b.position.set(px, py, pz);
        wallBodiesRef.current.push(b);
        world.addBody(b);
      };
      const yC = 1.2;
      makeWall(0, yC, half + thick / 2, half + thick, 1.6, thick / 2); // top wall (css up)
      makeWall(0, yC, -(half + thick / 2), half + thick, 1.6, thick / 2); // bottom
      makeWall(half + thick / 2, yC, 0, thick / 2, 1.6, half + thick); // right
      makeWall(-(half + thick / 2), yC, 0, thick / 2, 1.6, half + thick); // left
    }, [allowPx, pxToUnit]);

    /* ---------------- direct DOM writers (no re-render) ---------------- */
    const writePose = React.useCallback(
      (xPx: number, yPx: number, liftPx: number, q: { qx: number; qy: number; qz: number; qw: number }) => {
        if (groupRef.current) {
          groupRef.current.style.transform = `translate3d(${xPx.toFixed(2)}px, ${yPx.toFixed(2)}px, 0px)`;
        }
        if (cubeRef.current) {
          cubeRef.current.style.transform = `translate3d(0px, 0px, ${liftPx.toFixed(2)}px) ${cssMatrix(q)}`;
        }
        const liftF = clamp(liftPx / (s * 1.6), 0, 1);
        const sc = 1 - 0.26 * liftF;
        if (shadowRef.current) {
          shadowRef.current.style.opacity = String(0.5 - 0.3 * liftF);
          shadowRef.current.style.transform = `translate(-50%,-50%) scale(${sc.toFixed(3)})`;
        }
        if (auraRef.current) {
          auraRef.current.style.opacity = String(0.35 + 0.55 * liftF);
        }
      },
      [s]
    );

    const setTrail = React.useCallback((vxPx: number, vyPx: number, speed: number) => {
      const el = trailRef.current;
      if (!el) return;
      const a = Math.atan2(vyPx, vxPx);
      const len = clamp((speed / (s * 30)) * 1.7, 0, 1.1) * s * 1.1;
      const o = clamp(speed / (s * 26), 0, 0.85);
      el.style.opacity = String(o);
      if (o < 0.02) return;
      el.style.transform = `translate(-50%,-50%) rotate(${a}rad) translateX(${-h - len / 2}px) scaleX(${Math.max(0.2, len / (s * 0.5))})`;
    }, [s, h]);

    /** Convert an authoritative (css-space) pose into px + body placement. */
    const applyPoseToDom = React.useCallback(
      (p: LudoDicePose) => {
        poseRef.current = { ...p };
        writePose(p.x * boardPx, p.y * boardPx, 0, { qx: p.qx, qy: p.qy, qz: p.qz, qw: p.qw });
      },
      [boardPx, writePose]
    );

    /* ---------------- physics world ---------------- */
    React.useEffect(() => {
      if (!boardPx) return;
      // A rebuilt world starts idle (covers board resizes mid-flight).
      stopLoop();
      busyRef.current = false;
      modeRef.current = "idle";
      const world = new CANNON.World();
      world.gravity.set(0, -11.5, 0); // snappy mobile-feel gravity (die units)
      world.broadphase = new CANNON.NaiveBroadphase();
      world.allowSleep = false;

      const dieMat = new CANNON.Material("die");
      const boardMat = new CANNON.Material("board");
      world.addContactMaterial(
        new CANNON.ContactMaterial(dieMat, boardMat, {
          friction: 0.55,
          restitution: 0.38,
          contactEquationStiffness: 1e7,
          contactEquationRelaxation: 3,
        })
      );
      world.addContactMaterial(
        new CANNON.ContactMaterial(dieMat, dieMat, {
          friction: 0.3,
          restitution: 0.4,
        })
      );

      const body = new CANNON.Body({
        mass: 1,
        material: dieMat,
        linearDamping: 0.08,
        angularDamping: 0.16,
      });
      body.addShape(new CANNON.Box(new CANNON.Vec3(0.5, 0.5, 0.5)));
      world.addBody(body);

      worldRef.current = world;
      bodyRef.current = body;
      dieMatRef.current = dieMat;
      resetWorldGeometry();
      // Initial placement from the authoritative pose (falls back to centre).
      const p = poseRef.current ?? { x: 0.5, y: 0.5, qx: 0, qy: 0, qz: 0, qw: 1 };
      const cq = qToCannon({ qx: p.qx, qy: p.qy, qz: p.qz, qw: p.qw });
      body.position.set(
        ((p.x - 0.5) * boardPx) / s,
        0.5,
        ((0.5 - p.y) * boardPx) / s
      );
      body.quaternion.set(cq.x, cq.y, cq.z, cq.w);
      body.velocity.setZero();
      body.angularVelocity.setZero();
      applyPoseToDom(p);

      return () => {
        cancelAnimationFrame(rafRef.current);
        worldRef.current = null;
        bodyRef.current = null;
        wallBodiesRef.current = [];
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [boardPx, s]);

    React.useEffect(() => {
      resetWorldGeometry();
    }, [resetWorldGeometry]);

    /* ---------------- snapTo ---------------- */
    const snapTo = React.useCallback(
      (p: LudoDicePose) => {
        if (busyRef.current || modeRef.current !== "idle") return;
        poseRef.current = { ...p };
        applyPoseToDom(p);
        const body = bodyRef.current;
        if (body) {
          const cq = qToCannon({ qx: p.qx, qy: p.qy, qz: p.qz, qw: p.qw });
          body.position.set(((p.x - 0.5) * boardPx) / s, 0.5, ((0.5 - p.y) * boardPx) / s);
          body.quaternion.set(cq.x, cq.y, cq.z, cq.w);
          body.velocity.setZero();
          body.angularVelocity.setZero();
        }
      },
      [applyPoseToDom, boardPx, s]
    );

    /* ---------------- physics loop ---------------- */
    const stopLoop = React.useCallback(() => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }, []);

    const commitRest = React.useCallback(
      (fx: number, fy: number, liftPx: number, qcss: { qx: number; qy: number; qz: number; qw: number }) => {
        writePose(fx * boardPx, fy * boardPx, liftPx, qcss);
        poseRef.current = {
          x: fx,
          y: fy,
          rotX: 0,
          rotY: 0,
          rotZ: 0,
          qx: qcss.qx,
          qy: qcss.qy,
          qz: qcss.qz,
          qw: qcss.qw,
        };
      },
      [boardPx, writePose]
    );

    const startPhysics = React.useCallback(
      (dxPx: number, dyPx: number, velPx: number) => {
        const world = worldRef.current;
        const body = bodyRef.current;
        if (!world || !body || busyRef.current) return;
        busyRef.current = true;
        modeRef.current = "physics";
        onRollStartRef.current?.();

        const u = pxToUnit;
        // --- throw power from gesture length AND swipe velocity ---
        const glen = Math.hypot(dxPx, dyPx);
        const distFrac = glen / Math.max(1, s);
        const velFrac = velPx / Math.max(1, s * 14);
        const power = clamp(0.45 + distFrac * 0.38 + velFrac * 0.42, 0.45, 1.6);
        const dirX = glen > 6 ? dxPx / glen : Math.random() * 2 - 1;
        const dirY = glen > 6 ? dyPx / glen : 0.55 + Math.random() * 0.3;

        // Throw distance grows with power — a strong swipe can cross the board
        // (walls bounce it back), a tap is a short local toss.
        const travel = s * (1.6 + 6.2 * power) * u; // die units/s
        body.velocity.set(dirX * travel, 0, -dirY * travel);

        // Vertical toss so the die leaves the board and bounces like a real throw.
        const hop = (2.4 + 2.1 * power) * (dirY < 0 ? 1.12 : 1);
        body.velocity.y = Math.sqrt(2 * 11.5 * hop); // v = sqrt(2*g*h)

        // Rolling spin about the in-plane axis perpendicular to the travel,
        // plus turbulence so the cube genuinely tumbles (face changes).
        const rollRate = (2.2 + 4.6 * power) * (0.9 + Math.random() * 0.35);
        const wx = rollRate * (dirY / (Math.hypot(dirX, dirY) || 1));
        const wz = -rollRate * (dirX / (Math.hypot(dirX, dirY) || 1));
        const wob = 1.1 + Math.random() * 1.6;
        body.angularVelocity.set(
          wx * 0.6 + (Math.random() * 2 - 1) * wob,
          (Math.random() * 2 - 1) * wob * 0.9,
          wz * 0.6 + (Math.random() * 2 - 1) * wob
        );

        const start = performance.now();
        let prev = start;
        let calmMs = 0;
        const STABLE_MS = 170;
        let done = false;
        let bounceSfxAt = 0;

        const frame = (now: number) => {
          if (done || !bodyRef.current || !worldRef.current) return;
          const dt = Math.min(0.04, (now - prev) / 1000);
          prev = now;
          world.step(1 / 60, dt, 4);

          const p = body.position;
          const q = body.quaternion;
          const fx = clamp(p.x * s / boardPx + 0.5, 0, 1);
          const fy = clamp(-p.z * s / boardPx + 0.5, 0, 1);
          const lift = Math.max(0, p.y * s);
          const qcss = qFromCannon(q);
          writePose(fx * boardPx, fy * boardPx, lift, qcss);

          const lin = Math.hypot(body.velocity.x, body.velocity.y, body.velocity.z);
          const ang = Math.hypot(body.angularVelocity.x, body.angularVelocity.y, body.angularVelocity.z);
          const vxPx = body.velocity.x * s;
          const vyPx = -body.velocity.z * s;
          setTrail(vxPx, vyPx, Math.hypot(vxPx, vyPx));

          // Light "tick" contact sounds on the first hard floor bounce.
          if (p.y < 0.62 && now - bounceSfxAt > 120 && lift > s * 0.16 && now - start > 160) {
            bounceSfxAt = now;
          }

          const flying = p.y > 0.56;
          const t = (now - start) / 1000;
          const calm =
            t > 0.42 && !flying && lin < 0.16 && ang < 0.75;
          calmMs = calm ? calmMs + dt * 1000 : 0;

          if (calmMs >= STABLE_MS || t > 7) {
            done = true;
            // Final micro-settle: level the cube onto the winning face.
            const yaw = Math.atan2(2 * (qcss.qw * qcss.qz + qcss.qx * qcss.qy), 1 - 2 * (qcss.qy * qcss.qy + qcss.qz * qcss.qz));
            const flat = flatPoseFor(qcss, yaw);
            const fxF = clamp(p.x * s / boardPx + 0.5, 0, 1);
            const fyF = clamp(-p.z * s / boardPx + 0.5, 0, 1);
            modeRef.current = "level";
            const l0 = performance.now();
            const q0css = { ...qcss };
            const level = (n2: number) => {
              const lt = Math.min(1, (n2 - l0) / 140);
              const e = easeInOut(lt);
              const qq = slerp(q0css, flat.q, e);
              writePose(fxF * boardPx, fyF * boardPx, Math.max(0, (0.5 - Math.abs(0.5 - lt)) * s * 0.05) , qq);
              if (lt < 1) {
                rafRef.current = requestAnimationFrame(level);
              } else {
                setTrail(0, 0, 0);
                modeRef.current = "idle";
                busyRef.current = false;
                commitRest(fxF, fyF, 0, flat.q);
                const poseOut = poseRef.current;
                onSettledRef.current?.(poseOut, flat.value);
              }
            };
            rafRef.current = requestAnimationFrame(level);
            return;
          }
          rafRef.current = requestAnimationFrame(frame);
        };
        rafRef.current = requestAnimationFrame(frame);
      },
      [boardPx, pxToUnit, s, setTrail, writePose, commitRest]
    );

    /* ---------------- replay (remote / AI roll) ---------------- */
    const replayTo = React.useCallback(
      (target: LudoDicePose): Promise<void> => {
        stopLoop();
        busyRef.current = true;
        modeRef.current = "replay";
        const body = bodyRef.current;
        // Freeze the physics body under the visual.
        if (body) {
          body.velocity.setZero();
          body.angularVelocity.setZero();
        }
        const cur = poseRef.current;
        const x0 = cur.x * boardPx;
        const y0 = cur.y * boardPx;
        const x1 = target.x * boardPx;
        const y1 = target.y * boardPx;
        const q0 = { qx: cur.qx, qy: cur.qy, qz: cur.qz, qw: cur.qw };
        const q1 = { qx: target.qx, qy: target.qy, qz: target.qz, qw: target.qw };
        const dist = Math.hypot(x1 - x0, y1 - y0);
        // Tumble axis: mostly horizontal (in-plane), perpendicular to travel.
        let ax: [number, number, number] = [0, -1, 0];
        if (dist > 4) {
          const tx = (x1 - x0) / dist;
          const ty = (y1 - y0) / dist;
          ax = [-ty, tx, 0]; // in-plane axis perpendicular to direction
        }
        const dur = 900 + Math.min(500, dist * 1.6) + Math.random() * 260;
        const spins = 1.6 + (dist / (boardPx * 0.55)) * 2.2 + Math.random() * 0.8;
        const hopPx = Math.min(s * 1.5, s * (0.6 + dist / (boardPx * 0.8)));
        const start = performance.now();
        let prev = start;
        let trailVx = 0;
        let trailVy = 0;
        let prevPx = { x: x0, y: y0 };

        return new Promise<void>((resolve) => {
          const frame = (now: number) => {
            const dt = Math.min(0.04, (now - prev) / 1000);
            prev = now;
            const t = Math.min(1, (now - start) / dur);
            const e = easeInOut(t);
            // Travel eases; extra full spins modulate speed (fast mid-roll, slow ends).
            const spinA = spins * 2 * Math.PI * e;
            const tumble = axisAngle(ax, spinA);
            const qSpin = quatMul(slerp(q0, q1, easeInOut(t)), tumble);
            const qq = qSpin;
            normalizeQuat(qq);
            const xPx = x0 + (x1 - x0) * e;
            const yPx = y0 + (y1 - y0) * e;
            const liftPx = Math.sin(Math.PI * t) * hopPx;
            writePose(xPx, yPx, liftPx, qq);
            // trail driven by visual velocity
            const ivx = (xPx - prevPx.x) / Math.max(dt, 0.001);
            const ivy = (yPx - prevPx.y) / Math.max(dt, 0.001);
            trailVx = trailVx * 0.5 + ivx * 0.5;
            trailVy = trailVy * 0.5 + ivy * 0.5;
            prevPx = { x: xPx, y: yPx };
            setTrail(trailVx, trailVy, Math.hypot(trailVx, trailVy));
            if (t < 1) {
              rafRef.current = requestAnimationFrame(frame);
            } else {
              setTrail(0, 0, 0);
              // Land EXACTLY on the authoritative pose.
              writePose(x1, y1, 0, q1);
              poseRef.current = { ...target };
              modeRef.current = "idle";
              busyRef.current = false;
              resolve();
            }
          };
          rafRef.current = requestAnimationFrame(frame);
        });
      },
      [boardPx, s, stopLoop, setTrail, writePose]
    );

    /* ---------------- pointer / swipe handling ---------------- */
    const canGesture = () => canRoll && !busyRef.current && boardPx > 0;

    const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
      if (!canGesture()) return;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      const t = performance.now();
      gestureRef.current = {
        sx: e.clientX, sy: e.clientY, cx: e.clientX, cy: e.clientY, t0: t,
        px: e.clientX, py: e.clientY, pt: t, vx: 0, vy: 0,
      };
      pressedRef.current = true;
    };
    const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
      const g = gestureRef.current;
      if (!g) return;
      g.cx = e.clientX;
      g.cy = e.clientY;
      const t = performance.now();
      if (t - g.pt >= 22) {
        const dt = (t - g.pt) / 1000;
        if (dt > 0.001) {
          const vx = (g.cx - g.px) / dt;
          const vy = (g.cy - g.py) / dt;
          g.vx = g.vx * 0.5 + clamp(vx, -6000, 6000) * 0.5;
          g.vy = g.vy * 0.5 + clamp(vy, -6000, 6000) * 0.5;
        }
        g.px = g.cx;
        g.py = g.cy;
        g.pt = t;
      }
    };
    const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
      pressedRef.current = false;
      const g = gestureRef.current;
      gestureRef.current = null;
      if (!canGesture() || !g) return;
      const dx = e.clientX - g.sx;
      const dy = e.clientY - g.sy;
      const dur = performance.now() - g.t0;
      // Ignore long accidental holds; a quick tap still throws a small roll.
      if (Math.hypot(dx, dy) < 6 && dur > 700) return;
      const spd = Math.hypot(g.vx, g.vy);
      startPhysics(dx, dy, spd);
    };
    const onPointerCancel = () => {
      pressedRef.current = false;
      gestureRef.current = null;
    };

    /* ---------------- idle pose tracking (authoritative wins) ---------------- */
    const lastPoseProp = React.useRef<LudoDicePose | null>(null);
    React.useEffect(() => {
      if (!pose || lastPoseProp.current === pose) return;
      lastPoseProp.current = pose;
      if (busyRef.current || modeRef.current !== "idle") return;
      const cur = poseRef.current;
      const same =
        cur &&
        Math.abs(cur.x - pose.x) < 1e-4 &&
        Math.abs(cur.y - pose.y) < 1e-4 &&
        Math.abs(cur.qx - pose.qx) < 1e-3 &&
        Math.abs(cur.qy - pose.qy) < 1e-3 &&
        Math.abs(cur.qz - pose.qz) < 1e-3 &&
        Math.abs(cur.qw - pose.qw) < 1e-3;
      if (!same) snapTo(pose);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pose]);

    /* ---------------- expose handle ---------------- */
    React.useImperativeHandle(ref, () => ({
      replayTo,
      snapTo,
    }), [replayTo, snapTo]);

    /* ---------------- initial mount ---------------- */
    React.useEffect(() => {
      if (boardPx > 0) {
        poseRef.current = { ...pose };
        applyPoseToDom(pose);
        lastPoseProp.current = pose;
      }
      return () => {
        stopLoop();
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /* ---------------- static face nodes ---------------- */
    // Every face shows ITS number (1–6, opposite faces sum to 7) in a bold
    // gloss numeral tinted to the current player's colour.
    const faceNodes = React.useMemo(() => {
      const nodes: React.ReactNode[] = [];
      const faceRadius = Math.max(5, Math.round(s * 0.16));
      for (const { rot, value } of CSS_FACES) {
        nodes.push(
          <div
            key={value}
            className="absolute"
            style={{
              inset: 0,
              transform: `${rot} translateZ(${h}px)`,
              borderRadius: faceRadius,
              background: `radial-gradient(circle at 30% 18%, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.08) 42%), linear-gradient(155deg, ${theme.light} 0%, ${theme.base} 50%, ${theme.deep} 100%)`,
              border: `1px solid ${theme.border}`,
              boxShadow: `inset 0 -5px 9px ${theme.insetA}, inset 0 2px 3px ${theme.insetB}, 0 0 1px rgba(0,0,0,0.4)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
            }}
          >
            {/* value numeral */}
            <span
              className="relative z-[1] select-none leading-none"
              style={{
                color: theme.ink,
                textShadow: theme.inkShadow,
                fontSize: Math.max(16, Math.round(s * 0.46)),
                fontWeight: 900,
                fontStyle: "italic",
                fontVariantNumeric: "tabular-nums",
                letterSpacing: "-0.02em",
                WebkitFontSmoothing: "antialiased",
              }}
            >
              {value}
            </span>
            {/* specular sheen */}
            <span
              className="pointer-events-none absolute inset-0"
              style={{
                borderRadius: faceRadius,
                background:
                  "linear-gradient(115deg, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.14) 24%, rgba(255,255,255,0) 46%), linear-gradient(295deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0) 34%)",
              }}
            />
          </div>
        );
      }
      return nodes;
    }, [s, h, theme]);

    return (
      <div
        ref={rootRef}
        className="absolute inset-0 z-[45] overflow-visible"
        style={{ pointerEvents: "none", perspective: `${Math.max(240, s * 3.4)}px`, ["--die-rgb"]: theme.rgb } as React.CSSProperties}
      >
        <div
          ref={groupRef}
          className="absolute left-0 top-0"
          style={{ width: 0, height: 0, transformStyle: "preserve-3d" }}
        >
          {/* seat-coloured aura hugging the board under the die */}
          <div
            ref={auraRef}
            aria-hidden
            className="pointer-events-none absolute"
            style={{
              left: 0,
              top: 0,
              width: s * 1.7,
              height: s * 1.7,
              transform: "translate(-50%,-50%)",
              opacity: 0.42,
              background: `radial-gradient(circle, rgba(${theme.rgb},0.5) 0%, rgba(${theme.rgb},0.16) 46%, rgba(${theme.rgb},0) 70%)`,
              filter: "blur(6px)",
              willChange: "transform, opacity",
            }}
          />
          {/* contact shadow */}
          <div
            ref={shadowRef}
            aria-hidden
            className="pointer-events-none absolute"
            style={{
              left: 0,
              top: 0,
              width: s * 1.28,
              height: s * 0.34,
              transform: "translate(-50%,-50%)",
              opacity: 0.5,
              background:
                "radial-gradient(ellipse at center, rgba(10,2,0,0.62) 0%, rgba(10,2,0,0.28) 52%, rgba(10,2,0,0) 72%)",
              filter: "blur(2.5px)",
              willChange: "transform, opacity",
            }}
          />
          {/* motion trail (motion blur while the die is fast) */}
          <div
            ref={trailRef}
            aria-hidden
            className="pointer-events-none absolute"
            style={{
              left: 0,
              top: 0,
              width: s * 0.9,
              height: s * 0.5,
              transform: "translate(-50%,-50%)",
              opacity: 0,
              background: `radial-gradient(ellipse at 100% 50%, rgba(${theme.rgb},0.9) 0%, rgba(${theme.rgb},0.45) 55%, rgba(${theme.rgb},0) 100%)`,
              filter: "blur(1.5px)",
              willChange: "transform, opacity",
            }}
          />
          {/* cube */}
          <div
            ref={cubeRef}
            className={glow && canRoll ? "absolute ludo-die-ready" : "absolute"}
            style={{
              width: s,
              height: s,
              left: -h,
              top: -h,
              transformStyle: "preserve-3d",
              willChange: "transform, filter",
              filter: `drop-shadow(0 12px 18px ${theme.shadowBase})`,
            }}
          >
            {faceNodes}
          </div>
          {/* invisible interactive target — the die itself */}
          <div
            className={canRoll ? "cursor-grab active:cursor-grabbing" : ""}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
            style={{
              position: "absolute",
              left: -h - s * 0.22,
              top: -h - s * 0.22,
              width: s * 1.44,
              height: s * 1.44,
              borderRadius: "50%",
              pointerEvents: canRoll ? "auto" : "none",
              touchAction: "none",
              transform: pressedRef.current ? "scale(0.94)" : undefined,
            }}
            role={canRoll ? "button" : undefined}
            aria-label="Roll the dice — swipe it"
          />
        </div>
        <style>{`
          @keyframes ludoDieReady {
            0%, 100% { filter: drop-shadow(0 12px 18px ${theme.shadowBase}) drop-shadow(0 0 2px rgba(var(--die-rgb),0)); }
            50% { filter: drop-shadow(0 12px 18px ${theme.shadowBase}) drop-shadow(0 0 20px rgba(var(--die-rgb),0.95)); }
          }
          .ludo-die-ready { animation: ludoDieReady 1.5s ease-in-out infinite; }
          @keyframes ludoDieRecolor {
            0%, 100% { filter: drop-shadow(0 12px 18px ${theme.shadowBase}) brightness(1) saturate(1); }
            30% { filter: drop-shadow(0 12px 18px ${theme.shadowBase}) brightness(2.05) saturate(1.55); }
          }
          .ludo-die-recolor { animation: ludoDieRecolor 0.64s ease-out; }
        `}</style>
      </div>
    );
  }
);

export default LudoPhysicalDice;
