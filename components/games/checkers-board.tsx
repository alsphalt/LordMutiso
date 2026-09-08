"use client";

import { useState, useMemo } from "react";
import { type GameSnapshot } from "@/lib/games/types";
import {
  legalCheckersMoves,
  pieceSide,
  isKing,
  type CheckersState,
} from "@/lib/games/checkers/engine";
import { cn } from "@/lib/utils";

interface CheckersBoardProps {
  snapshot: GameSnapshot;
  act: (body: any) => Promise<any>;
  isActing: boolean;
}

export function CheckersBoard({ snapshot, act, isActing }: CheckersBoardProps) {
  const { game, seats, isMyTurn } = snapshot;
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
    const move = moves.find((item) => item.from === selected && item.to === idx);
    if (move) {
      act({ action: "move", from: selected!, to: idx });
      setSelected(null);
      return;
    }
    const piece = state.board[idx];
    if (piece !== 0 && pieceSide(piece) === state.turn) {
      if (state.chain !== null && state.chain !== idx) return;
      setSelected(idx);
    } else {
      setSelected(null);
    }
  };

  const isOver = ["FINISHED", "DRAW"].includes(game.status);

  return (
    <div className="flex h-full w-full flex-col gap-4">
      <div className="relative aspect-square w-full [perspective:1200px]" aria-label="Three dimensional checkers board">
        <div className="absolute inset-[3%] rounded-[5%] bg-[#241a14] shadow-[0_24px_30px_rgba(0,0,0,0.55),inset_0_2px_0_rgba(255,255,255,0.14)] [transform:rotateX(16deg)_translateY(-2%)] [transform-style:preserve-3d]">
          <div className="absolute -bottom-3 left-[3%] right-[3%] h-5 rounded-b-[18px] bg-[#120d0a] shadow-[0_8px_10px_rgba(0,0,0,0.5)]" aria-hidden />
          <div className="absolute inset-[2.4%] rounded-[3%] bg-[#6f4d35] p-[1.6%] shadow-[inset_0_1px_0_rgba(255,255,255,0.35),inset_0_-8px_18px_rgba(0,0,0,0.45)]">
            <div className="grid h-full w-full grid-cols-8 grid-rows-8 overflow-hidden rounded-[1.5%] border border-black/30">
              {Array.from({ length: 64 }).map((_, idx) => {
                const r = Math.floor(idx / 8);
                const c = idx % 8;
                const isDark = (r + c) % 2 === 1;
                const piece = state.board[idx];
                const isSelected = selected === idx;
                const isLegalTarget = moves.some((m) => m.from === selected && m.to === idx);
                const isMustMove = state.chain === idx || (state.chain === null && moves.some((m) => m.from === idx));
                const side = piece === 0 ? 0 : pieceSide(piece);
                return (
                  <button
                    key={idx}
                    type="button"
                    aria-label={`Square ${idx + 1}${piece ? `, ${side === 1 ? "light" : "dark"} piece` : "empty"}`}
                    onClick={() => onSquareClick(idx)}
                    className={cn(
                      "group relative flex items-center justify-center transition-colors focus-visible:z-20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300",
                      isDark ? "bg-[#44261d]" : "bg-[#d2a56e]",
                      isSelected && "bg-amber-300/70",
                      isLegalTarget && "bg-cyan-300/40"
                    )}
                  >
                    <span className="absolute inset-0 shadow-[inset_0_1px_2px_rgba(255,255,255,0.14),inset_0_-2px_3px_rgba(0,0,0,0.26)]" aria-hidden />
                    {isLegalTarget && <span className="size-[22%] rounded-full bg-cyan-200/80 shadow-[0_0_12px_rgba(103,232,249,0.75)]" aria-hidden />}
                    {piece !== 0 && (
                      <span
                        className={cn(
                          "relative z-10 flex size-[78%] items-center justify-center rounded-full border-2 transition-transform [transform:translateZ(12px)] [transform-style:preserve-3d]",
                          side === 1
                            ? "border-[#aeb7c4] bg-gradient-to-br from-[#fbfdff] via-[#d9e1e9] to-[#8995a4] text-[#637080]"
                            : "border-[#8d273d] bg-gradient-to-br from-[#ff7289] via-[#c83250] to-[#65172e] text-[#ffd4dc]",
                          "shadow-[0_7px_0_rgba(0,0,0,0.28),0_10px_12px_rgba(0,0,0,0.35),inset_0_2px_2px_rgba(255,255,255,0.55),inset_0_-6px_8px_rgba(0,0,0,0.28)]",
                          isSelected && "scale-110 -translate-y-1 shadow-[0_11px_0_rgba(0,0,0,0.3),0_16px_16px_rgba(0,0,0,0.42)]",
                          isMustMove && isMyTurn && !isOver && "ring-2 ring-cyan-300 ring-offset-2 ring-offset-transparent animate-pulse"
                        )}
                      >
                        <span className="absolute inset-[12%] rounded-full border border-white/25" aria-hidden />
                        {isKing(piece) && <span className="relative text-lg font-black leading-none">K</span>}
                      </span>
                    )}
                    {c === 0 && <span className="absolute left-1 top-1 text-[8px] font-mono opacity-35">{8 - r}</span>}
                    {r === 7 && <span className="absolute bottom-1 right-1 text-[8px] font-mono opacity-35">{"abcdefgh"[c]}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center gap-4 rounded-xl border border-white/10 bg-white/5 py-2">
        {seats.map((seat) => (
          <div key={seat.id} className={cn("flex items-center gap-2 rounded-lg border px-3 py-1.5 transition-all", state.turn === seat.playerNumber ? "scale-105 border-white/20 bg-white/10 shadow-lg" : "border-transparent opacity-40 grayscale")}>
            <span className={cn("size-3 rounded-full", seat.playerNumber === 1 ? "bg-slate-100" : "bg-rose-600")} />
            <span className="text-xs font-bold uppercase tracking-wider text-white">{seat.username}</span>
            {state.turn === seat.playerNumber && <span className="size-1.5 animate-ping rounded-full bg-cyan-300" />}
          </div>
        ))}
      </div>
    </div>
  );
}
