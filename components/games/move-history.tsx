"use client";

import { type GameSnapshot, type MoveDTO, COLOR_HEX } from "@/lib/games/types";
import { cn } from "@/lib/utils";
import { useEffect, useRef } from "react";

interface MoveHistoryProps {
  snapshot: GameSnapshot;
}

export function MoveHistory({ snapshot }: MoveHistoryProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { recentMoves, game } = snapshot;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [recentMoves.length]);

  return (
    <div className="flex flex-col h-full">
      <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider px-1 mb-2">
        Move History
      </h3>
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto pr-2 flex flex-col gap-1.5 scrollbar-thin scrollbar-thumb-white/10"
      >
        {recentMoves.length === 0 ? (
          <div className="text-xs text-slate-500 italic p-2 bg-white/5 rounded-lg border border-dashed border-white/5">
            No moves yet
          </div>
        ) : (
          recentMoves.map((move) => (
            <div 
              key={move.id} 
              className="flex items-start gap-3 p-2 rounded-lg bg-white/5 border border-white/5 hover:bg-white/[0.08] transition-colors group"
            >
              <div className="flex flex-col items-center gap-1 shrink-0 w-8">
                <span className="text-[10px] font-mono text-slate-500">{move.moveNumber}.</span>
                <div 
                  className="w-2 h-2 rounded-full ring-2 ring-black shadow-[0_0_8px_rgba(0,0,0,0.5)]" 
                  style={{ backgroundColor: COLOR_HEX[snapshot.seats.find(s => s.playerNumber === move.playerNumber)?.color || "WHITE"] }}
                />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline gap-2 mb-0.5">
                  <span className="text-[11px] font-semibold text-slate-300 truncate">
                    {move.username}
                  </span>
                  <span className="text-[9px] text-slate-500 font-mono">
                    {new Date(move.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
                <div className="text-xs text-slate-100 font-medium">
                  {formatMove(move, game.type)}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
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
        return `🎲 ${data.die} • Token ${data.token + 1}: ${data.fromR === -1 ? "Base" : data.fromR} → ${data.toR === 56 ? "Finish" : data.toR}${data.capture ? " ⚔️" : ""}${data.extraRoll ? " (+1 roll)" : ""}`;
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
