"use client";

import { useEffect, useRef } from "react";
import { History } from "lucide-react";
import { type GameSnapshot, type MoveDTO } from "@/lib/games/types";
import { cn } from "@/lib/utils";

interface MoveHistoryProps {
  snapshot: GameSnapshot;
}

/** MOVE HISTORY panel — glass card with compact, reference-style rows. */
export function MoveHistory({ snapshot }: MoveHistoryProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { recentMoves, game, mySeatNumber, seats } = snapshot;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [recentMoves.length]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl">
      {/* header */}
      <div className="flex shrink-0 items-center justify-between border-b border-white/[0.06] px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          <History className="h-3.5 w-3.5 text-violet-300/80" />
          <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">
            Move History
          </span>
        </div>
        {recentMoves.length > 0 && (
          <span className="font-mono text-[10px] tabular-nums text-slate-600">
            {recentMoves.length}
          </span>
        )}
      </div>

      {/* scrollable list */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-2.5 py-2 [scrollbar-width:thin]"
      >
        {recentMoves.length === 0 ? (
          <div className="flex h-full min-h-[90px] flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/[0.06] text-center">
            <p className="text-xs italic text-slate-600">No moves yet — first move opens the game.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {recentMoves.map((move, i) => {
              const isLatest = i === recentMoves.length - 1;
              const seat = seats.find((s) => s.playerNumber === move.playerNumber);
              const isAi = !!seat?.isAi;
              const isMine = mySeatNumber === move.playerNumber;
              return (
                <div
                  key={move.id}
                  className={cn(
                    "rounded-xl border px-2.5 py-1.5 transition-colors",
                    isLatest
                      ? "border-violet-400/25 bg-violet-500/[0.08]"
                      : "border-transparent bg-white/[0.02] hover:bg-white/[0.04]"
                  )}
                >
                  <div className="flex items-baseline gap-2">
                    <span className="w-7 shrink-0 font-mono text-[10px] tabular-nums text-slate-600">
                      {move.moveNumber}.
                    </span>
                    <span
                      className={cn(
                        "truncate text-[11px] font-semibold leading-none",
                        isAi
                          ? "text-cyan-300/90"
                          : isMine
                          ? "text-violet-300"
                          : "text-slate-300"
                      )}
                    >
                      {move.username}
                      {isMine && <span className="ml-1 font-normal text-violet-400/70">(You)</span>}
                    </span>
                    <span className="ml-auto shrink-0 font-mono text-[9px] tabular-nums text-slate-600">
                      {timeOf(move.createdAt)}
                    </span>
                  </div>
                  <p
                    className={cn(
                      "mt-0.5 pl-9 text-[11px] font-medium leading-snug",
                      isLatest ? "text-violet-100" : "text-slate-300/80"
                    )}
                  >
                    {formatMove(move, game.type)}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function timeOf(isoStr: string): string {
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
}

function formatMove(move: MoveDTO, type: string): string {
  const data = move.moveData as any;
  if (!data) return "Unknown move";

  if (data.kind === "resign") {
    return "Resigned";
  }

  switch (type) {
    case "LUDO":
      if (data.kind === "ludo-move") {
        return `🎲 ${data.die} · Token ${data.token + 1}: ${data.fromR === -1 ? "Base" : data.fromR} → ${data.toR === 56 ? "Finish" : data.toR}${data.capture ? " ⚔️" : ""}${data.extraRoll ? " (+1 roll)" : ""}`;
      }
      if (data.kind === "ludo-roll") {
        return `🎲 Rolled ${data.die}${data.autoPassed ? " (auto-pass)" : ""}`;
      }
      return "Action";
    case "CHESS":
      return data.san || `${formatChessSquare(data.from)} → ${formatChessSquare(data.to)}${data.promotion ? `=${data.promotion.toUpperCase()}` : ""}`;
    case "CHECKERS":
      return `${formatCheckersSquare(data.from)} → ${formatCheckersSquare(data.to)}${data.capture ? " ✕" : ""}${data.crowned ? " 👑" : ""}`;
    default:
      return "Action recorded";
  }
}

function formatChessSquare(idx: number): string {
  if (idx < 0 || idx > 63) return "?";
  const file = "abcdefgh"[idx & 7];
  const rank = 8 - (idx >> 3);
  return `${file}${rank}`;
}

function formatCheckersSquare(idx: number): string {
  if (idx < 0 || idx > 63) return "?";
  const r = idx >> 3;
  const c = idx & 7;
  return `${String.fromCharCode(97 + c)}${8 - r}`;
}
