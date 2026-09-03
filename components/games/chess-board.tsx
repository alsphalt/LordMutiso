"use client";

import { useState, useMemo, useEffect } from "react";
import { type GameSnapshot, COLOR_HEX } from "@/lib/games/types";
import { Chess, type Square } from "chess.js";
import { cn } from "@/lib/utils";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";

interface ChessBoardProps {
  snapshot: GameSnapshot;
  act: (body: any) => Promise<any>;
  isActing: boolean;
}

const PIECES: Record<string, string> = {
  wP: "♙", wR: "♖", wN: "♘", wB: "♗", wQ: "♕", wK: "♔",
  bP: "♟", bR: "♜", bN: "♞", bB: "♝", bQ: "♛", bK: "♚",
};

export function ChessBoard({ snapshot, act, isActing }: ChessBoardProps) {
  const { game, seats, mySeatNumber, isMyTurn } = snapshot;
  const state = snapshot.state as any;
  const [selected, setSelected] = useState<number | null>(null);
  const [promotionMove, setPromotionMove] = useState<{ from: number; to: number } | null>(null);

  const chess = useMemo(() => new Chess(state.fen), [state.fen]);
  const isBlack = mySeatNumber === 2;

  const board = useMemo(() => {
    const b = chess.board();
    return isBlack ? [...b].reverse().map(row => [...row].reverse()) : b;
  }, [chess, isBlack]);

  const legalMoves = useMemo(() => {
    if (selected === null) return [];
    const square = squareAlg(selected);
    return chess.moves({ square: square as Square, verbose: true });
  }, [chess, selected]);

  const onSquareClick = (idx: number) => {
    if (isOver || !isMyTurn || isActing) return;

    if (selected === idx) {
      setSelected(null);
      return;
    }

    const move = legalMoves.find(m => squareNum(m.to) === idx);
    if (move) {
      // Check for promotion
      if (move.flags.includes("p")) {
        setPromotionMove({ from: selected!, to: idx });
      } else {
        act({ action: "move", from: selected!, to: idx });
      }
      setSelected(null);
    } else {
      const piece = chess.get(squareAlg(idx) as Square);
      if (piece && piece.color === chess.turn()) {
        setSelected(idx);
      } else {
        setSelected(null);
      }
    }
  };

  const isOver = ["FINISHED", "DRAW"].includes(game.status);
  const inCheck = chess.inCheck();

  return (
    <div className="w-full h-full flex flex-col gap-4">
      <div className="relative aspect-square w-full grid grid-cols-8 grid-rows-8 border-4 border-black/20 rounded-sm overflow-hidden shadow-2xl">
        {Array.from({ length: 8 }).map((_, r) => (
          Array.from({ length: 8 }).map((_, c) => {
            const actualR = isBlack ? 7 - r : r;
            const actualC = isBlack ? 7 - c : c;
            const idx = actualR * 8 + actualC;
            const square = squareAlg(idx);
            const piece = chess.get(square as Square);
            const isDark = (actualR + actualC) % 2 === 1;
            const isSelected = selected === idx;
            const isLegalTarget = legalMoves.some(m => squareNum(m.to) === idx);
            const isCheck = inCheck && piece?.type === "k" && piece?.color === chess.turn();

            return (
              <div
                key={idx}
                onClick={() => onSquareClick(idx)}
                className={cn(
                  "relative flex items-center justify-center cursor-pointer transition-colors",
                  isDark ? "bg-[#b58863]" : "bg-[#f0d9b5]",
                  isSelected && "bg-yellow-400/60",
                  isCheck && "bg-rose-500/80 shadow-inner"
                )}
              >
                {/* Square Coordinate Labels */}
                {actualC === 0 && (
                  <span className={cn(
                    "absolute top-0.5 left-0.5 text-[8px] font-bold",
                    isDark ? "text-[#f0d9b5]" : "text-[#b58863]"
                  )}>
                    {8 - actualR}
                  </span>
                )}
                {actualR === 7 && (
                  <span className={cn(
                    "absolute bottom-0.5 right-0.5 text-[8px] font-bold",
                    isDark ? "text-[#f0d9b5]" : "text-[#b58863]"
                  )}>
                    {"abcdefgh"[actualC]}
                  </span>
                )}

                {piece && (
                  <span 
                    className={cn(
                      "text-4xl sm:text-5xl select-none z-10 drop-shadow-sm",
                      piece.color === "w" ? "text-white" : "text-slate-900"
                    )}
                    style={{ 
                       textShadow: piece.color === "w" ? "0 0 2px black" : "0 0 2px white",
                    }}
                  >
                    {PIECES[piece.color + piece.type.toUpperCase()]}
                  </span>
                )}

                {isLegalTarget && (
                  <div className={cn(
                    "absolute w-3 h-3 rounded-full z-20",
                    piece ? "border-4 border-black/20 w-8 h-8 rounded-full" : "bg-black/10"
                  )} />
                )}
              </div>
            );
          })
        ))}
      </div>

      <Modal 
        open={!!promotionMove} 
        onClose={() => setPromotionMove(null)} 
        title="Promote Pawn"
      >
        <div className="grid grid-cols-4 gap-4 p-4">
          {[
            { id: "q", label: "Queen", icon: chess.turn() === "w" ? "♕" : "♛" },
            { id: "r", label: "Rook", icon: chess.turn() === "w" ? "♖" : "♜" },
            { id: "b", label: "Bishop", icon: chess.turn() === "w" ? "♗" : "♝" },
            { id: "n", label: "Knight", icon: chess.turn() === "w" ? "♘" : "♞" },
          ].map((p) => (
            <Button
              key={p.id}
              variant="outline"
              className="flex flex-col gap-2 h-24 text-3xl"
              onClick={() => {
                act({ action: "move", ...promotionMove, promotion: p.id });
                setPromotionMove(null);
              }}
            >
              {p.icon}
              <span className="text-[10px] uppercase font-bold tracking-tighter">{p.label}</span>
            </Button>
          ))}
        </div>
      </Modal>
    </div>
  );
}

function squareAlg(idx: number): string {
  const file = "abcdefgh"[idx & 7];
  const rank = 8 - (idx >> 3);
  return `${file}${rank}`;
}

function squareNum(alg: string): number {
  const f = alg.charCodeAt(0) - 97;
  const r = 8 - parseInt(alg[1]);
  return r * 8 + f;
}
