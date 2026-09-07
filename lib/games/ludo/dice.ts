/**
 * Ludo physical dice — shared, serializable pose types & pure helpers.
 *
 * Client-safe: no server-only imports. The physics client (cannon-es), the
 * DOM cube and the server (persisting the authoritative pose) all agree on
 * this single coordinate/face convention.
 *
 * Coordinate convention — CSS 3D space of the board plane
 * --------------------------------------------------------
 * The die lives ON the board square, which is rendered as a CSS 3D plane:
 *   +X  -> right (board column direction)
 *   +Y  -> DOWN the screen (board row direction)
 *   +Z  -> toward the viewer (board plane normal)
 * A resting die sits at z = 0 (board surface) with its body extending toward
 * the viewer (+Z). The face the viewer sees is therefore the +Z face — that
 * is the face whose value IS the rolled number.
 *
 * Face convention (opposite faces sum to 7):
 *   +Z  = 1 (front, shown when resting)     -Z = 6 (back)
 *   +X  = 3 (right)                        -X = 4 (left)
 *   -Y  = 2 (screen-up side)               +Y = 5 (screen-down side)
 *
 * Pose fields
 * -----------
 *   - x, y   -> centre of the cube as FRACTIONS of the board square (0..1,
 *               same space as the CSS left/top layout) — survives any screen
 *               size and network sync.
 *   - qx..qw -> the cube's rotation (identity = face 1 facing the viewer).
 *   - rotX/rotY/rotZ -> informational euler degrees derived from q.
 */

export interface LudoDicePose {
  x: number;
  y: number;
  rotX: number; // degrees
  rotY: number; // degrees
  rotZ: number; // degrees
  qx: number;
  qy: number;
  qz: number;
  qw: number;
}

/** Resting spot used before the first roll of a game (board centre, face 1). */
export const DEFAULT_DICE_POSE: LudoDicePose = {
  x: 0.5,
  y: 0.5,
  rotX: 0,
  rotY: 0,
  rotZ: 0,
  qx: 0,
  qy: 0,
  qz: 0,
  qw: 1,
};

/** How far a dice centre may roam from the board centre (fraction of board). */
export const DICE_ROAM = 0.365;

/** Viewer direction (+Z) — the face that "reads" as the result. */
export const UP: [number, number, number] = [0, 0, 1];

/** Local axis -> face value (axes in CSS board-plane space, see header). */
export const AXIS_FACES: ReadonlyArray<{ axis: [number, number, number]; value: number }> = [
  { axis: [0, 0, 1], value: 1 },
  { axis: [0, 0, -1], value: 6 },
  { axis: [0, -1, 0], value: 2 },
  { axis: [0, 1, 0], value: 5 },
  { axis: [1, 0, 0], value: 3 },
  { axis: [-1, 0, 0], value: 4 },
];

export function axisOfFace(value: number): [number, number, number] {
  return (AXIS_FACES.find((a) => a.value === value) ?? AXIS_FACES[0]).axis as [number, number, number];
}

export interface QuatLike {
  qx: number;
  qy: number;
  qz: number;
  qw: number;
}

/** Rotate a local vector by a quaternion (q v q*). */
export function rotateVecByQuat(v: [number, number, number], q: QuatLike): [number, number, number] {
  const { qx, qy, qz, qw } = q;
  // t = 2 * cross(q.xyz, v)
  const tx = 2 * (qy * v[2] - qz * v[1]);
  const ty = 2 * (qz * v[0] - qx * v[2]);
  const tz = 2 * (qx * v[1] - qy * v[0]);
  return [
    v[0] + qw * tx + qy * tz - qz * ty,
    v[1] + qw * ty + qz * tx - qx * tz,
    v[2] + qw * tz + qx * ty - qy * tx,
  ];
}

/** Hamilton product a*b. */
export function quatMul(a: QuatLike, b: QuatLike): QuatLike {
  return {
    qx: a.qx * b.qw + a.qw * b.qx + a.qy * b.qz - a.qz * b.qy,
    qy: a.qy * b.qw + a.qw * b.qy + a.qz * b.qx - a.qx * b.qz,
    qz: a.qz * b.qw + a.qw * b.qz + a.qx * b.qy - a.qy * b.qx,
    qw: a.qw * b.qw - a.qx * b.qx - a.qy * b.qy - a.qz * b.qz,
  };
}

export function quatConj(q: QuatLike): QuatLike {
  return { qx: -q.qx, qy: -q.qy, qz: -q.qz, qw: q.qw };
}

/** Axis-angle (radians) -> quaternion. */
export function axisAngleQuat(axis: [number, number, number], angle: number): QuatLike {
  const len = Math.hypot(axis[0], axis[1], axis[2]) || 1;
  const s = Math.sin(angle / 2);
  return {
    qx: (axis[0] / len) * s,
    qy: (axis[1] / len) * s,
    qz: (axis[2] / len) * s,
    qw: Math.cos(angle / 2),
  };
}

/**
 * Which face of a die rotated by `q` is pointing at the viewer (+Z)?
 * Returns 1..6 — the physical dice result.
 */
export function topFaceOf(q: QuatLike): number {
  let best = AXIS_FACES[0];
  let bestDot = -Infinity;
  for (const { axis, value } of AXIS_FACES) {
    const r = rotateVecByQuat(axis, q);
    const d = r[2]; // alignment with +Z (viewer)
    if (d > bestDot) {
      bestDot = d;
      best = { axis, value };
    }
  }
  return best.value;
}

/** Normalise a quaternion in place. */
export function normalizeQuat(q: QuatLike): void {
  const len = Math.hypot(q.qx, q.qy, q.qz, q.qw);
  if (len < 1e-9) {
    q.qx = 0;
    q.qy = 0;
    q.qz = 0;
    q.qw = 1;
    return;
  }
  q.qx /= len;
  q.qy /= len;
  q.qz /= len;
  q.qw /= len;
}

/** Quaternion -> euler degrees (informational; the quaternion is authoritative). */
export function quatToEulerDeg(q: QuatLike): { rotX: number; rotY: number; rotZ: number } {
  const { qx, qy, qz, qw } = q;
  const d = 180 / Math.PI;
  const rotX = Math.atan2(2 * (qw * qx + qy * qz), 1 - 2 * (qx * qx + qy * qy));
  const rotY = Math.asin(Math.min(1, Math.max(-1, 2 * (qw * qy - qz * qx))));
  const rotZ = Math.atan2(2 * (qw * qz + qx * qy), 1 - 2 * (qy * qy + qz * qz));
  return { rotX: rotX * d, rotY: rotY * d, rotZ: rotZ * d };
}

/** Clamp + normalise an incoming (client/network) pose into a safe one. */
export function normalizeDicePose(raw: Partial<LudoDicePose> | null | undefined): LudoDicePose {
  const p: LudoDicePose = { ...DEFAULT_DICE_POSE };
  if (!raw || typeof raw !== "object") return p;
  const clamp = (v: unknown, lo: number, hi: number, fb: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fb;
  };
  p.x = clamp(raw.x, 0, 1, 0.5);
  p.y = clamp(raw.y, 0, 1, 0.5);
  p.qx = clamp(raw.qx, -1.0001, 1.0001, 0);
  p.qy = clamp(raw.qy, -1.0001, 1.0001, 0);
  p.qz = clamp(raw.qz, -1.0001, 1.0001, 0);
  p.qw = clamp(raw.qw, -1.0001, 1.0001, 1);
  normalizeQuat(p);
  const e = quatToEulerDeg(p);
  p.rotX = e.rotX;
  p.rotY = e.rotY;
  p.rotZ = e.rotZ;
  return p;
}

/**
 * Quaternion that places the face carrying `value` toward the viewer (+Z),
 * then spins it by an optional yaw around the viewer axis. Used to build
 * authoritative server poses whose visible face matches the rolled number.
 */
export function poseQuatForFace(value: number, yawRad = 0): QuatLike {
  const n = axisOfFace(value);
  const dot = n[2]; // dot(n, UP)
  let align: QuatLike;
  if (dot > 0.999999) {
    align = { qx: 0, qy: 0, qz: 0, qw: 1 };
  } else if (dot < -0.999999) {
    align = axisAngleQuat([1, 0, 0], Math.PI);
  } else {
    const ax = [n[1] * UP[2] - n[2] * UP[1], n[2] * UP[0] - n[0] * UP[2], n[0] * UP[1] - n[1] * UP[0]] as [number, number, number];
    const angle = Math.acos(Math.min(1, Math.max(-1, dot)));
    align = axisAngleQuat(ax, angle);
  }
  if (Math.abs(yawRad) > 1e-6) {
    return quatMul(axisAngleQuat(UP, yawRad), align);
  }
  return align;
}

/**
 * Random resting pose (server-side AI / idle rolls). The visible face
 * matches `die` when provided, so observers see a consistent result.
 */
export function randomDicePose(die?: number): LudoDicePose {
  const value = die ?? (1 + Math.floor(Math.random() * 6));
  const q = poseQuatForFace(value, Math.random() * Math.PI * 2);
  const e = quatToEulerDeg(q);
  return {
    x: 0.5 + (Math.random() * 2 - 1) * DICE_ROAM,
    y: 0.5 + (Math.random() * 2 - 1) * DICE_ROAM,
    rotX: e.rotX,
    rotY: e.rotY,
    rotZ: e.rotZ,
    qx: q.qx,
    qy: q.qy,
    qz: q.qz,
    qw: q.qw,
  };
}

/** Loose equality for pose comparison (used to skip self-echo replays). */
export function posesEqual(a: LudoDicePose | null | undefined, b: LudoDicePose | null | undefined): boolean {
  if (!a || !b) return false;
  return (
    Math.abs(a.x - b.x) < 1e-4 &&
    Math.abs(a.y - b.y) < 1e-4 &&
    Math.abs(a.qx - b.qx) < 1e-3 &&
    Math.abs(a.qy - b.qy) < 1e-3 &&
    Math.abs(a.qz - b.qz) < 1e-3 &&
    Math.abs(a.qw - b.qw) < 1e-3
  );
}

/** Dots layout per face value (3x3 pip grid indices 0..8). */
export const FACE_DOTS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

/**
 * CSS face recipes — IDENTICAL transforms to the original validated cube so
 * geometry is preserved; numbers follow the convention above (opposite pairs
 * 1-6, 2-5, 3-4).
 */
export const CSS_FACES: Array<{ name: string; rot: string; value: number }> = [
  { name: "front", rot: "", value: 1 }, // +Z — the face the viewer reads
  { name: "back", rot: "rotateY(180deg)", value: 6 }, // -Z
  { name: "right", rot: "rotateY(90deg)", value: 3 }, // +X
  { name: "left", rot: "rotateY(-90deg)", value: 4 }, // -X
  { name: "top", rot: "rotateX(90deg)", value: 2 }, // -Y side
  { name: "bottom", rot: "rotateX(-90deg)", value: 5 }, // +Y side
];
