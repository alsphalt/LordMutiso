"use client";

import * as React from "react";
import type { GameSnapshot } from "@/lib/games/types";
import { legalLudoMoves } from "@/lib/games/ludo/engine";
import type { LudoState } from "@/lib/games/ludo/engine";
import { legalCheckersMoves } from "@/lib/games/checkers/engine";
import type { CheckersState } from "@/lib/games/checkers/engine";
import { chooseLudoMove, chooseCheckersMove, chooseChessMove } from "@/lib/games/ai";
import { Chess } from "chess.js";

export const IDLE_LIMIT_S = 15;

/** Decide the best legal auto action for the current player (all games). */
export function autoActionFor(snapshot: GameSnapshot): Record<string, unknown> | null {
  const g = snapshot.game;
  if (g.status !== "PLAYING") return null;
  const my = snapshot.mySeatNumber;
  if (my === null || g.currentTurn !== my) return null;

  if (g.type === "LUDO") {
    const state = snapshot.state as unknown as LudoState;
    if (!state || typeof state !== "object") return null;
    if ((state as { phase?: string }).phase === "ROLL") return { action: "roll" };
    if ((state as { die?: number | null }).die == null) return { action: "roll" };
    const legal = legalLudoMoves(state);
    if (legal.length === 0) return { action: "roll" }; // roll wasted, server passes
    const token = chooseLudoMove(state, my, legal, "MEDIUM");
    if (token === null || token === undefined) return null;
    return { action: "move", token };
  }

  if (g.type === "CHESS") {
    const state = snapshot.state as unknown as { fen?: string };
    if (!state || typeof state.fen !== "string") return null;
    try {
      const mv = chooseChessMove(state.fen, "MEDIUM");
      if (!mv) return null;
      return { action: "move", from: mv.from, to: mv.to, promotion: mv.promotion ?? undefined };
    } catch {
      return null;
    }
  }

  if (g.type === "CHECKERS") {
    const state = snapshot.state as unknown as CheckersState;
    if (!state || typeof state !== "object") return null;
    const legal = legalCheckersMoves(state);
    if (legal.length === 0) return null;
    const mv = chooseCheckersMove(state, legal, "MEDIUM");
    if (!mv) return null;
    return { action: "move", from: mv.from, to: mv.to };
  }

  return null;
}

/**
 * If the human player does nothing for IDLE_LIMIT_S seconds on their turn,
 * the game politely plays a legal best move for them (server still validates
 * everything). Shows a small countdown bubble while idle.
 */
export function IdleAutoplay({ snapshot, act }: { snapshot: GameSnapshot; act: (body: any) => Promise<any> }) {
  const [left, setLeft] = React.useState(0);
  const firingRef = React.useRef(false);
  const g = snapshot.game;
  const my = snapshot.mySeatNumber;
  const myTurn =
    g.status === "PLAYING" && g.currentTurn !== null && g.currentTurn === my && my !== null;

  // Key = any game/action change restarts the 15s window.
  const movesKey = snapshot.recentMoves.length;
  const key = `${g.id}:${g.currentTurn}:${movesKey}`;

  React.useEffect(() => {
    firingRef.current = false;
    setLeft(0);
    if (!myTurn) return;

    // Chess sanity guard: never auto-move when the client sees an ended game.
    if (g.type === "CHESS") {
      try {
        const c = new Chess((snapshot.state as unknown as { fen?: string }).fen);
        if (c.isGameOver()) return;
      } catch {
        /* state may be mid-update; polling will fix */
      }
    }

    const start = Date.now();
    const iv = window.setInterval(() => {
      const rem = IDLE_LIMIT_S - (Date.now() - start) / 1000;
      if (rem <= 0) {
        window.clearInterval(iv);
        if (!firingRef.current) {
          firingRef.current = true;
          const body = autoActionFor(snapshot);
          if (body) {
            act(body)
              .catch(() => {
                firingRef.current = false;
              })
              .finally(() => {
                window.setTimeout(() => {
                  firingRef.current = false;
                }, 1500);
              });
          } else {
            firingRef.current = false;
          }
        }
      } else {
        setLeft(Math.max(1, Math.ceil(rem)));
      }
    }, 250);
    return () => window.clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, myTurn, g.id]);

  if (!myTurn || left <= 0) return null;

  return (
    <div className="pointer-events-none fixed left-1/2 top-[4.2rem] z-[70] -translate-x-1/2">
      <div className="flex items-center gap-2 rounded-full border border-amber-400/30 bg-black/70 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-300 shadow-lg backdrop-blur-md">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
        </span>
        Auto in {left}s
      </div>
    </div>
  );
}
