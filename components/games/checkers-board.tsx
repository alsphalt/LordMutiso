"use client";

import { useState, useMemo } from "react";
import { type GameSnapshot, COLOR_HEX } from "@/lib/games/types";
import { 
  legalCheckersMoves, 
  checkersMovesFor, 
  pieceSide, 
  isKing,
  type CheckersState,
  type CheckersMove
} from "@/lib/games/checkers/engine";
import { cn } from "@/lib/utils";

interface CheckersBoardProps {
  snapshot: GameSnapshot;
  act: (body: any) => Promise<any>;
  isActing: boolean;
}

export function CheckersBoard({ snapshot, act, isActing }: CheckersBoardProps) {
  const { game, seats, mySeatNumber, isMyTurn } = snapshot;
  const state = snapshot.state as unknown as CheckersState;
  const [selected, setSelected] = useState<number | null>(null);

  const moves = useMemo(() => {
    if (!isMyTurn || game.status !== "PLAYING") return [];
    return legalCheckersMoves(state);
  }, [state, isMyTurn, game.status]);

  const onSquareClick = (idx: number) => {
    if (!isMyTurn || isActing || game.status !== "PLAYING") return;

    if (selected === idx) {
      setSelected(null);
      return;
    }

    const move = moves.find(m => m.from === selected && m.to === idx);
    if (move) {
      act({ action: "move", from: selected!, to: idx });
      setSelected(null);
    } else {
      const piece = state.board[idx];
      if (piece !== 0 && pieceSide(piece) === state.turn) {
        // If there's a chain, only the chain piece can be selected
        if (state.chain !== null && state.chain !== idx) return;
        setSelected(idx);
      } else {
        setSelected(null);
      }
    }
  };

  const isOver = ["FINISHED", "DRAW"].includes(game.status);

  return (
    <div className="w-full h-full flex flex-col gap-4">
      <div className="relative aspect-square w-full grid grid-cols-8 grid-rows-8 border-4 border-black/20 rounded-sm overflow-hidden shadow-2xl">
        {Array.from({ length: 64 }).map((_, idx) => {
          const r = Math.floor(idx / 8);
          const c = idx % 8;
          const isDark = (r + c) % 2 === 1;
          const piece = state.board[idx];
          const isSelected = selected === idx;
          const isLegalTarget = moves.some(m => m.from === selected && m.to === idx);
          const isMustMove = state.chain === idx || (state.chain === null && moves.some(m => m.from === idx));

          return (
            <div
              key={idx}
              onClick={() => onSquareClick(idx)}
              className={cn(
                "relative flex items-center justify-center cursor-pointer transition-colors",
                isDark ? "bg-[#402010]" : "bg-[#d0b080]",
                isSelected && "bg-yellow-400/40",
                isLegalTarget && "after:content-[''] after:w-4 after:h-4 after:bg-black/20 after:rounded-full"
              )}
            >
              {piece !== 0 && (
                <div
                  className={cn(
                    "w-[80%] h-[80%] rounded-full shadow-lg border-2 border-black/20 flex items-center justify-center transition-transform",
                    pieceSide(piece) === 1 ? "bg-slate-100" : "bg-rose-600",
                    isMustMove && isMyTurn && !isOver && "ring-2 ring-indigo-400 ring-offset-2 ring-offset-transparent animate-pulse",
                    isSelected && "scale-110 shadow-2xl z-10"
                  )}
                >
                  {isKing(piece) && (
                    <div className={cn(
                      "text-xl",
                      pieceSide(piece) === 1 ? "text-slate-400" : "text-rose-200"
                    )}>
                      👑
                    </div>
                  )}
                </div>
              )}

              {/* Coordinate hints (optional) */}
              {c === 0 && <span className="absolute top-0.5 left-0.5 text-[8px] opacity-20">{8 - r}</span>}
              {r === 7 && <span className="absolute bottom-0.5 right-0.5 text-[8px] opacity-20">{"abcdefgh"[c]}</span>}
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-center gap-4 py-2 bg-white/5 rounded-xl border border-white/10">
        {seats.map(seat => (
          <div 
            key={seat.id} 
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all",
              state.turn === seat.playerNumber 
                ? "bg-white/10 border-white/20 scale-105 shadow-lg" 
                : "opacity-40 border-transparent grayscale"
            )}
          >
            <div 
              className={cn("w-3 h-3 rounded-full", seat.playerNumber === 1 ? "bg-slate-100" : "bg-rose-600")}
            />
            <span className="text-xs font-bold text-white uppercase tracking-wider">{seat.username}</span>
            {state.turn === seat.playerNumber && <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping" />}
          </div>
        ))}
      </div>
    </div>
  );
}
