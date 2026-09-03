"use client";

import { useState, useEffect } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { COLOR_HEX, type GameSnapshot, type GamePlayerDTO } from "@/lib/games/types";
import { cn } from "@/lib/utils";

interface PlayersPanelProps {
  snapshot: GameSnapshot;
}

export function PlayersPanel({ snapshot }: PlayersPanelProps) {
  const { game, seats, mySeatNumber } = snapshot;

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider px-1">
        Players
      </h3>
      <div className="flex flex-col gap-1">
        {seats.map((seat) => {
          const isTurn = game.status === "PLAYING" && game.currentTurn === seat.playerNumber;
          const isMe = mySeatNumber === seat.playerNumber;
          const status = getPlayerStatus(seat, snapshot);

          return (
            <div
              key={seat.id}
              className={cn(
                "flex items-center gap-3 p-2 rounded-xl transition-all border border-transparent",
                isTurn ? "bg-white/10 border-white/10 shadow-lg shadow-black/20" : "bg-white/5",
                isMe && "ring-1 ring-inset ring-indigo-500/50"
              )}
            >
              <div className="relative">
                <Avatar username={seat.username} src={seat.image || undefined} size={40} />
                <div
                  className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-[#07030f]"
                  style={{ backgroundColor: COLOR_HEX[seat.color] }}
                />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate text-slate-100">
                    {seat.username}
                    {isMe && <span className="ml-1 text-xs text-slate-400 font-normal">(You)</span>}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  {status && (
                    <Badge
                      tone={
                        status === "Winner"
                          ? "green"
                          : status === "Lost" || status === "Resigned"
                          ? "rose"
                          : "slate"
                      }
                      className="text-[10px] py-0 px-1.5 h-4"
                    >
                      {status}
                    </Badge>
                  )}
                  {isTurn && (
                    <span className="flex h-1.5 w-1.5 rounded-full bg-indigo-400 animate-pulse" />
                  )}
                </div>
              </div>

              {game.type === "CHESS" && (
                <ChessClock snapshot={snapshot} playerNumber={seat.playerNumber} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function getPlayerStatus(seat: GamePlayerDTO, snapshot: GameSnapshot): string | null {
  const { game, state } = snapshot;
  
  if (game.status === "FINISHED") {
    return game.winnerId === seat.userId ? "Winner" : "Lost";
  }

  // Check engine-specific state if available
  if (game.type === "LUDO" && state) {
    const ludoState = state as any;
    if (ludoState.done?.includes(seat.playerNumber)) return "Winner";
    if (ludoState.resigned?.includes(seat.playerNumber)) return "Resigned";
  } else if (game.type === "CHECKERS" && game.status === "DRAW") {
    return "Draw";
  }

  return null;
}

function ClockDisplay({ baseRemaining, isTurn, lastTickMs }: { baseRemaining: number, isTurn: boolean, lastTickMs: number }) {
  const [currentMs, setCurrentMs] = useState(baseRemaining);

  useEffect(() => {
    if (!isTurn) {
      setCurrentMs(baseRemaining);
      return;
    }

    const interval = setInterval(() => {
      const elapsedSinceLastTick = Date.now() - lastTickMs;
      const remaining = Math.max(0, baseRemaining - elapsedSinceLastTick);
      setCurrentMs(remaining);
    }, 100);
    return () => clearInterval(interval);
  }, [baseRemaining, isTurn, lastTickMs]);

  const totalSec = Math.floor(currentMs / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;

  return (
    <div className={cn(
      "font-mono text-xs tabular-nums px-2 py-1 rounded bg-black/40 border border-white/5",
      isTurn ? "text-indigo-400 border-indigo-500/30" : "text-slate-400"
    )}>
      {m.toString().padStart(2, '0')}:{s.toString().padStart(2, '0')}
    </div>
  );
}

function ChessClock({ snapshot, playerNumber }: { snapshot: GameSnapshot; playerNumber: number }) {
  const { game, state } = snapshot;
  if (game.type !== "CHESS") return null;

  const chessState = state as any;
  const isWhite = playerNumber === 1;
  const baseRemaining = isWhite ? chessState.wMs : chessState.bMs;
  const isTurn = game.status === "PLAYING" && game.currentTurn === playerNumber;

  return (
    <ClockDisplay 
      baseRemaining={baseRemaining} 
      isTurn={isTurn} 
      lastTickMs={chessState.lastTickMs} 
    />
  );
}
