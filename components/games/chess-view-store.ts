"use client";

/**
 * Tiny shared store for the chess board view (3D / 2D).
 *
 * The choice is persisted in localStorage (SSR-safe, guarded) and kept in sync
 * between the in-screen header settings (GameShell) and the board renderer
 * (ChessBoard) via a simple subscribe/notify set — no context, no prop drilling.
 */

export type ChessView = "3D" | "2D";

const KEY = "dna_chess_view";
let cache: ChessView | null = null;
const listeners = new Set<(v: ChessView) => void>();

function read(): ChessView {
  if (typeof window === "undefined") return "3D";
  if (cache) return cache;
  try {
    const s = window.localStorage.getItem(KEY);
    cache = s === "2D" || s === "3D" ? s : "3D";
  } catch {
    cache = "3D";
  }
  return cache;
}

export function getChessView(): ChessView {
  return read();
}

export function setChessView(view: ChessView): void {
  cache = view;
  try {
    window.localStorage.setItem(KEY, view);
  } catch {
    /* ignore storage errors */
  }
  listeners.forEach((fn) => fn(view));
}

export function subscribeChessView(fn: (v: ChessView) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
