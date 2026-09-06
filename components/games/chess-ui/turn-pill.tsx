"use client";

import { useEffect, useState } from "react";
import { Clock3, Cpu } from "lucide-react";
import type { GameSnapshot } from "@/lib/games/types";
import { IDLE_LIMIT_S } from "@/components/games/idle-autoplay";
import { cn } from "@/lib/utils";

/**
 * TurnStatusPill — the single status strip rendered directly under the header.
 *
 *  - On the HUMAN player's turn: purple neon "AUTO IN {n}s" countdown (the same
 *    15s-per-action window used by <IdleAutoplay/>, reset whenever the turn or
 *    the move count changes, ticking once per second).
 *  - On an AI seat's turn (AI mode): cyan "{BOT NAME} (MEDIUM) IS THINKING…"
 *    with a soft pulsing glow.
 *  - Any other time (opponent's turn, game over, spectating): renders nothing.
 *
 * This component is presentation-only — it never dispatches actions. The actual
 * auto-play firing lives in IdleAutoplay (which is mounted by the shell with the
 * exact same reset key, so both stay in lock-step).
 */
export function TurnStatusPill({ snapshot }: { snapshot: GameSnapshot }) {
  const { game, seats, isMyTurn, isPlayer } = snapshot;
  const [left, setLeft] = useState(0);

  // Same key as idle-autoplay.tsx: any turn change OR new move restarts the 15s window.
  const movesKey = snapshot.recentMoves.length;
  const key = `${game.id}:${game.currentTurn}:${movesKey}`;

  const isLive = game.status === "PLAYING" && isMyTurn && isPlayer;

  useEffect(() => {
    setLeft(0);
    if (!isLive) return;

    const start = Date.now();
    const iv = window.setInterval(() => {
      const rem = IDLE_LIMIT_S - (Date.now() - start) / 1000;
      if (rem <= 0) {
        setLeft(0);
      } else {
        // ceil so we count 15,14,…,1 (the auto move fires when rem hits 0)
        setLeft(Math.max(1, Math.ceil(rem)));
      }
    }, 500);
    return () => window.clearInterval(iv);
  }, [key, isLive]);

  if (["FINISHED", "DRAW", "CANCELLED"].includes(game.status)) return null;

  const aiSeat =
    game.gameMode === "AI" && game.status === "PLAYING" && game.currentTurn !== null
      ? seats.find((s) => s.playerNumber === game.currentTurn && s.isAi) ?? null
      : null;

  // AI seat is thinking — cyan pill with a soft pulsing glow.
  if (aiSeat) {
    return (
      <div className="pointer-events-none flex justify-center">
        <div className="flex items-center gap-2 rounded-full border border-cyan-400/25 bg-cyan-400/[0.07] py-1.5 pl-3.5 pr-4 shadow-[0_0_22px_-6px_rgba(34,211,238,0.55)] backdrop-blur-md animate-pulse">
          <Cpu className="h-3.5 w-3.5 shrink-0 text-cyan-300" />
          <span className="whitespace-nowrap text-[11px] font-bold uppercase tracking-[0.12em] text-cyan-200/90">
            {aiSeat.username} is thinking…
          </span>
        </div>
      </div>
    );
  }

  // Human player's live auto-move countdown — purple neon outline glow.
  if (isLive && left > 0) {
    return (
      <div className="pointer-events-none flex justify-center">
        <div className="relative flex items-center gap-2 rounded-full border border-violet-400/40 bg-[#150b2b]/85 py-1.5 pl-3.5 pr-4 shadow-[0_0_20px_-4px_rgba(168,85,247,0.75)] ring-1 ring-violet-500/20 backdrop-blur-md">
          <Clock3 className="h-3.5 w-3.5 shrink-0 text-violet-300" />
          <span
            className={cn(
              "whitespace-nowrap text-[11px] font-bold uppercase tracking-[0.12em]",
              left <= 5 ? "text-cyan-200" : "text-violet-100"
            )}
          >
            Auto in {left}s
          </span>
        </div>
      </div>
    );
  }

  return null;
}
