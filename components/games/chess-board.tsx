"use client";

import { useState, useMemo, useEffect, useSyncExternalStore } from "react";
import { type GameSnapshot } from "@/lib/games/types";
import { Chess, type Square } from "chess.js";
import { cn } from "@/lib/utils";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { getChessView, setChessView, subscribeChessView, type ChessView } from "./chess-view-store";

interface ChessBoardProps {
  snapshot: GameSnapshot;
  act: (body: any) => Promise<any>;
  isActing: boolean;
}

const PIECES: Record<string, string> = {
  wP: "♙", wR: "♖", wN: "♘", wB: "♗", wQ: "♕", wK: "♔",
  bP: "♟", bR: "♜", bN: "♞", bB: "♝", bQ: "♛", bK: "♚",
};

/* Subtle marble textures (kept low-contrast so pieces stay readable). */
const SQ_LIGHT =
  "radial-gradient(62% 62% at 30% 18%, rgba(255,255,255,0.5), rgba(255,255,255,0) 72%), radial-gradient(50% 55% at 74% 86%, rgba(146,92,38,0.10), rgba(146,92,38,0) 72%), linear-gradient(135deg, #f2dfba 0%, #ecd0a3 45%, #dfbd8e 100%)";
const SQ_DARK =
  "radial-gradient(60% 70% at 26% 15%, rgba(255,228,182,0.17), rgba(255,228,182,0) 72%), radial-gradient(50% 60% at 78% 88%, rgba(118,58,138,0.10), rgba(118,58,138,0) 74%), linear-gradient(135deg, #9f7751 0%, #8a5f3d 45%, #6c4830 100%)";

/**
 * Inline SVG silhouette geometry for each piece type (viewBox 0 0 45 45).
 * Shapes have no fill so they inherit the fill set on the wrapping <g>.
 */
function PieceShapes({ type }: { type: string }) {
  switch (type) {
    case "p":
      return (
        <>
          <circle cx="22.5" cy="9.6" r="5.5" />
          <rect x="16.4" y="14.4" width="12.2" height="5.4" rx="2.6" />
          <path d="M17.2 18.8 C19 23.6 19.6 27.2 17.5 30.2 C15.6 32.7 12.9 33.7 10.9 34.4 L34.1 34.4 C32.1 33.7 29.4 32.7 27.5 30.2 C25.4 27.2 26 23.6 27.8 18.8 Z" />
          <rect x="10.6" y="33" width="23.8" height="7.4" rx="3.2" />
        </>
      );
    case "r":
      return (
        <>
          <rect x="13.1" y="6.4" width="3.4" height="8" rx="1.4" />
          <rect x="18.3" y="6.4" width="3.4" height="8" rx="1.4" />
          <rect x="23.5" y="6.4" width="3.4" height="8" rx="1.4" />
          <rect x="28.7" y="6.4" width="3.4" height="8" rx="1.4" />
          <rect x="13.1" y="13.6" width="19" height="5" rx="2" />
          <rect x="16" y="16.2" width="13" height="19.4" rx="3.6" />
          <rect x="9.3" y="34.8" width="26.4" height="6.2" rx="2.9" />
        </>
      );
    case "n":
      return (
        <>
          <rect x="25.4" y="4.2" width="3.4" height="9" rx="1.7" transform="rotate(12 27.1 11.8)" />
          <rect x="21" y="5" width="3.4" height="8.4" rx="1.7" transform="rotate(-9 22.7 12.6)" />
          <rect x="14.4" y="11.6" width="14.8" height="9.8" rx="4.7" />
          <circle cx="12" cy="16.6" r="4.6" />
          <circle cx="14.7" cy="20" r="4.8" />
          <rect x="15" y="19.8" width="15.6" height="15.6" rx="4.6" />
          <rect x="7.8" y="34.8" width="29.4" height="6.4" rx="3.2" />
        </>
      );
    case "b":
      return (
        <>
          <circle cx="22.5" cy="7" r="3.4" />
          <path d="M22.5 8.6 C19.9 9.8 17.8 12.9 17.1 16.4 C16.9 17.4 17.7 18.1 18.7 17.9 L20.6 17.7 C21.4 14.7 22.1 11.5 22.5 8.6 Z" />
          <path d="M22.5 8.6 C25.1 9.8 27.2 12.9 27.9 16.4 C28.1 17.4 27.3 18.1 26.3 17.9 L24.4 17.7 C23.6 14.7 22.9 11.5 22.5 8.6 Z" />
          <rect x="16.9" y="16.8" width="11.2" height="4.6" rx="2.2" />
          <path d="M16.6 19.4 C18.2 23.8 18.8 27 17.2 29.9 C15.9 32.2 13.9 33.6 12 34.4 L33 34.4 C31.1 33.6 29.1 32.2 27.8 29.9 C26.2 27 26.8 23.8 28.4 19.4 Z" />
          <rect x="10.4" y="34.2" width="24.2" height="6.6" rx="3.1" />
        </>
      );
    case "q":
      return (
        <>
          <path d="M16.9 13.2 L18.6 9.4 L20.3 13.2 Z" />
          <path d="M21 13.2 L22.5 6 L24 13.2 Z" />
          <path d="M24.7 13.2 L26.4 9.4 L28.1 13.2 Z" />
          <circle cx="18.6" cy="8.6" r="2" />
          <circle cx="22.5" cy="5.4" r="2.2" />
          <circle cx="26.4" cy="8.6" r="2" />
          <rect x="15.2" y="13.2" width="14.6" height="5.2" rx="2.2" />
          <path d="M16.6 18.4 C18.2 22.8 18.8 26 17.2 28.9 C15.9 31.2 13.9 32.6 12 33.4 L33 33.4 C31.1 32.6 29.1 31.2 27.8 28.9 C26.2 26 26.8 22.8 28.4 18.4 Z" />
          <rect x="10.4" y="33.4" width="24.2" height="7.4" rx="3.4" />
        </>
      );
    case "k":
      return (
        <>
          <rect x="21.25" y="5" width="2.5" height="10.6" rx="1.25" />
          <rect x="18.7" y="7.6" width="7.6" height="2.5" rx="1.25" />
          <rect x="15.6" y="13.8" width="13.8" height="5" rx="2.2" />
          <path d="M16.6 18.8 C18.2 23.2 18.8 26.4 17.2 29.3 C15.9 31.6 13.9 33 12 33.8 L33 33.8 C31.1 33 29.1 31.6 27.8 29.3 C26.2 26.4 26.8 23.2 28.4 18.8 Z" />
          <rect x="10.4" y="33.6" width="24.2" height="7.2" rx="3.3" />
        </>
      );
    default:
      return null;
  }
}

export function ChessBoard({ snapshot, act, isActing }: ChessBoardProps) {
  const { game, seats, mySeatNumber, isMyTurn } = snapshot;
  const state = snapshot.state as any;
  const [selected, setSelected] = useState<number | null>(null);
  const [promotionMove, setPromotionMove] = useState<{ from: number; to: number } | null>(null);

  // Board view (3D/2D) — owned by the shared store so the header gear and the
  // board always agree. The mount effect hydrates the saved preference (SSR
  // renders the default 3D board, then it snaps to the user's saved choice).
  const boardStyle = useSyncExternalStore<ChessView>(subscribeChessView, getChessView, () => "3D");
  useEffect(() => {
    setChessView(getChessView());
  }, []);

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

  // Last played chess move (for soft square highlights): cyan when the AI
  // played it, purple when a human did. Presentation-only.
  const lastMove = useMemo(() => {
    const mv = snapshot.recentMoves[snapshot.recentMoves.length - 1];
    if (!mv) return null;
    const d = mv.moveData as any;
    if (!d || d.kind !== "chess-move" || typeof d.from !== "number" || typeof d.to !== "number") return null;
    const seat = seats.find((s) => s.playerNumber === mv.playerNumber);
    return { from: d.from, to: d.to, isAi: !!seat?.isAi };
  }, [snapshot.recentMoves, seats]);

  return (
    <div className="w-full h-full flex flex-col gap-4">
      <div className="relative w-full aspect-square shrink-0">
        {/* Keyed 220ms fade container — remounts whenever the view style switches */}
        <div key={boardStyle} className="absolute inset-0 animate-in fade-in duration-[220ms]">
          {boardStyle === "3D" ? (
            /* ------------------------------------------------------------------ */
            /* 3D BOARD — perspective slab, purple neon rim, SVG silhouette pieces */
            /* ------------------------------------------------------------------ */
            <div className="relative h-full w-full" style={{ perspective: "1500px", perspectiveOrigin: "50% 30%" }}>
              {/* gradient definitions shared by every piece */}
              <svg aria-hidden className="absolute h-0 w-0" width="0" height="0">
                <defs>
                  <linearGradient id="dnaChessW" x1="0" y1="0" x2="0" y2="1" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#fffdf6" />
                    <stop offset="42%" stopColor="#f6e7c7" />
                    <stop offset="76%" stopColor="#e2c194" />
                    <stop offset="100%" stopColor="#cba97b" />
                  </linearGradient>
                  <linearGradient id="dnaChessB" x1="0" y1="0" x2="0" y2="1" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#5a5476" />
                    <stop offset="28%" stopColor="#3d3650" />
                    <stop offset="58%" stopColor="#262034" />
                    <stop offset="100%" stopColor="#161120" />
                  </linearGradient>
                </defs>
              </svg>

              <div
                className="absolute inset-0"
                style={{ transform: "rotateX(18deg)", transformStyle: "preserve-3d", willChange: "transform" }}
              >
                {/* stacked dark back plate → raised thickness */}
                <div
                  className="absolute inset-0 rounded-[14px] border border-violet-400/25"
                  style={{
                    transform: "translateZ(-18px)",
                    background: "linear-gradient(180deg,#3b1a6e,#170b33 60%,#0b0520)",
                  }}
                />

                {/* raised rim — slim inner bevel (outer stage owns the drop shadows) */}
                <div
                  className="relative rounded-[12px] p-[4px]"
                  style={{
                    background: "linear-gradient(150deg,#8b5cf6,#4c1d95 40%,#37306b 70%,#27204d)",
                    boxShadow:
                      "0 0 0 1px rgba(167,139,250,0.28), 0 0 12px rgba(147,51,234,0.32), inset 0 0 0 1px rgba(255,255,255,0.05), 0 2px 0 #241040, 0 5px 0 #180b2e, 0 8px 14px rgba(0,0,0,0.5)",
                  }}
                >
                  <div
                    className="relative grid aspect-square grid-cols-8 grid-rows-8 overflow-hidden rounded-[8px] ring-1 ring-white/10"
                    style={{ background: "#0d0820" }}
                  >
                    {Array.from({ length: 8 }).map((_, r) =>
                      Array.from({ length: 8 }).map((_, c) => {
                        const actualR = isBlack ? 7 - r : r;
                        const actualC = isBlack ? 7 - c : c;
                        const idx = actualR * 8 + actualC;
                        const square = squareAlg(idx);
                        const piece = chess.get(square as Square);
                        const isDark = (actualR + actualC) % 2 === 1;
                        const isSelected = selected === idx;
                        const isLastFrom = lastMove?.from === idx;
                        const isLastTo = lastMove?.to === idx;
                        const isLastMoveHighlight = isLastFrom || isLastTo;
                        const isLegalTarget = legalMoves.some(m => squareNum(m.to) === idx);
                        const isCheck = inCheck && piece?.type === "k" && piece?.color === chess.turn();

                        return (
                          <div
                            key={idx}
                            onClick={() => onSquareClick(idx)}
                            className="relative flex cursor-pointer items-center justify-center"
                            style={{ background: isDark ? SQ_DARK : SQ_LIGHT }}
                          >
                            {/* last move highlight — cyan for AI, purple for humans */}
                            {isLastMoveHighlight && !isSelected && (
                              <div
                                className={cn(
                                  "pointer-events-none absolute inset-0",
                                  lastMove?.isAi ? "bg-cyan-400/20" : "bg-violet-500/20"
                                )}
                              />
                            )}
                            {/* soft human selection / check glow */}
                            {isSelected && (
                              <div className="pointer-events-none absolute inset-0 bg-violet-500/25" />
                            )}
                            {isCheck && (
                              <div className="pointer-events-none absolute inset-0 bg-rose-500/40" />
                            )}
                            {isSelected && (
                              <div className="pointer-events-none absolute inset-0 ring-2 ring-inset ring-violet-300/70" />
                            )}
                            {isCheck && (
                              <div className="pointer-events-none absolute inset-0 shadow-inner ring-2 ring-inset ring-rose-300/70" />
                            )}
                            {isLastMoveHighlight && !isSelected && (
                              <div
                                className={cn(
                                  "pointer-events-none absolute inset-0 ring-1 ring-inset",
                                  lastMove?.isAi ? "ring-cyan-300/50" : "ring-violet-300/45"
                                )}
                              />
                            )}

                            {/* Square Coordinate Labels */}
                            {actualC === 0 && (
                              <span
                                className={cn(
                                  "absolute left-[3px] top-[2px] z-[3] text-[8px] font-bold leading-none",
                                  isDark ? "text-[#e2d2b2]" : "text-[#7d5f42]"
                                )}
                              >
                                {8 - actualR}
                              </span>
                            )}
                            {actualR === 7 && (
                              <span
                                className={cn(
                                  "absolute bottom-[2px] right-[3px] z-[3] text-[8px] font-bold leading-none",
                                  isDark ? "text-[#e2d2b2]" : "text-[#7d5f42]"
                                )}
                              >
                                {"abcdefgh"[actualC]}
                              </span>
                            )}

                            {/* SVG silhouette piece: contact shadow + dark back layer + gradient front */}
                            {piece && (
                              <div className="pointer-events-none absolute inset-0 z-[2]">
                                {/* ellipse contact shadow */}
                                <div className="absolute bottom-[3%] left-[16%] h-[10%] w-[68%] rounded-[50%] bg-black/40 blur-[2px]" />
                                {/* stacked dark back-layer for depth */}
                                <svg
                                  aria-hidden
                                  className="absolute left-[8%] top-[5%] h-[88%] w-[84%] translate-x-[3%] translate-y-[4%]"
                                  viewBox="0 0 45 45"
                                >
                                  <g fill="#0b0816">
                                    <PieceShapes type={piece.type} />
                                  </g>
                                </svg>
                                {/* gradient-filled silhouette */}
                                <svg
                                  aria-hidden
                                  className="absolute left-[8%] top-[5%] h-[88%] w-[84%]"
                                  viewBox="0 0 45 45"
                                  style={{
                                    filter:
                                      piece.color === "w"
                                        ? "drop-shadow(0 1.6px 1px rgba(96,48,14,0.5)) drop-shadow(0 3.5px 3px rgba(30,10,40,0.3))"
                                        : "drop-shadow(0 1.6px 1px rgba(0,0,0,0.7)) drop-shadow(0 3.5px 3px rgba(76,29,149,0.4))",
                                  }}
                                >
                                  <g fill={piece.color === "w" ? "url(#dnaChessW)" : "url(#dnaChessB)"}>
                                    <PieceShapes type={piece.type} />
                                  </g>
                                </svg>
                                {/* material sheen — warm on ivory, faint purple on charcoal */}
                                <div
                                  aria-hidden
                                  className="absolute left-[12%] top-[2%] h-[34%] w-[76%] rounded-t-full"
                                  style={{
                                    background:
                                      piece.color === "w"
                                        ? "radial-gradient(80% 100% at 50% 0%, rgba(255,255,255,0.5), rgba(255,255,255,0) 72%)"
                                        : "radial-gradient(80% 100% at 50% 0%, rgba(167,139,250,0.3), rgba(167,139,250,0) 74%)",
                                  }}
                                />
                              </div>
                            )}

                            {isLegalTarget && (
                              <div
                                className={cn(
                                  "absolute z-20 rounded-full transition-transform",
                                  piece
                                    ? "h-7 w-7 border-[3px] border-violet-300/55 shadow-[0_0_10px_rgba(139,92,246,0.35)]"
                                    : "h-2.5 w-2.5 bg-violet-300/60 shadow-[0_0_8px_rgba(139,92,246,0.4)]"
                                )}
                              />
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* ------------------------------------------------------------------ */
            /* 2D BOARD — flat marble look, same interaction model                 */
            /* ------------------------------------------------------------------ */
            <div className="relative grid aspect-square w-full grid-cols-8 grid-rows-8 overflow-hidden rounded-[2px] ring-1 ring-black/40 shadow-inner">
              {Array.from({ length: 8 }).map((_, r) =>
                Array.from({ length: 8 }).map((_, c) => {
                  const actualR = isBlack ? 7 - r : r;
                  const actualC = isBlack ? 7 - c : c;
                  const idx = actualR * 8 + actualC;
                  const square = squareAlg(idx);
                  const piece = chess.get(square as Square);
                  const isDark = (actualR + actualC) % 2 === 1;
                  const isSelected = selected === idx;
                  const isLastFrom = lastMove?.from === idx;
                  const isLastTo = lastMove?.to === idx;
                  const isLastMoveHighlight = isLastFrom || isLastTo;
                  const isLegalTarget = legalMoves.some(m => squareNum(m.to) === idx);
                  const isCheck = inCheck && piece?.type === "k" && piece?.color === chess.turn();

                  return (
                    <div
                      key={idx}
                      onClick={() => onSquareClick(idx)}
                      className="relative flex cursor-pointer items-center justify-center"
                      style={{ background: isDark ? SQ_DARK : SQ_LIGHT }}
                    >
                      {/* soft glows (last move / selection / check) */}
                      {isLastMoveHighlight && !isSelected && (
                        <div
                          className={cn(
                            "pointer-events-none absolute inset-0",
                            lastMove?.isAi ? "bg-cyan-400/20" : "bg-violet-500/20"
                          )}
                        />
                      )}
                      {isSelected && (
                        <div className="pointer-events-none absolute inset-0 bg-violet-500/25" />
                      )}
                      {isCheck && (
                        <div className="pointer-events-none absolute inset-0 bg-rose-500/40" />
                      )}
                      {isSelected && (
                        <div className="pointer-events-none absolute inset-0 ring-2 ring-inset ring-violet-300/70" />
                      )}
                      {isCheck && (
                        <div className="pointer-events-none absolute inset-0 shadow-inner ring-2 ring-inset ring-rose-300/70" />
                      )}
                      {isLastMoveHighlight && !isSelected && (
                        <div
                          className={cn(
                            "pointer-events-none absolute inset-0 ring-1 ring-inset",
                            lastMove?.isAi ? "ring-cyan-300/50" : "ring-violet-300/45"
                          )}
                        />
                      )}

                      {/* Square Coordinate Labels */}
                      {actualC === 0 && (
                        <span className={cn(
                          "absolute top-0.5 left-1 text-[8px] font-bold",
                          isDark ? "text-[#e2d2b2]" : "text-[#7d5f42]"
                        )}>
                          {8 - actualR}
                        </span>
                      )}
                      {actualR === 7 && (
                        <span className={cn(
                          "absolute bottom-0.5 right-1 text-[8px] font-bold",
                          isDark ? "text-[#e2d2b2]" : "text-[#7d5f42]"
                        )}>
                          {"abcdefgh"[actualC]}
                        </span>
                      )}

                      {piece && (
                        <span
                          className="z-10 select-none text-4xl sm:text-5xl"
                          style={{
                            color: piece.color === "w" ? "#f6ead2" : "#241f35",
                            textShadow:
                              piece.color === "w"
                                ? "0 1px 1px rgba(96,48,14,0.45), 0 2px 4px rgba(30,10,40,0.3)"
                                : "0 1px 1px rgba(255,255,255,0.12), 0 2px 3px rgba(0,0,0,0.45), 0 0 8px rgba(139,92,246,0.35)",
                          }}
                        >
                          {PIECES[piece.color + piece.type.toUpperCase()]}
                        </span>
                      )}

                      {isLegalTarget && (
                        <div className={cn(
                          "absolute z-20 rounded-full",
                          piece
                            ? "h-7 w-7 border-[3px] border-violet-300/55 shadow-[0_0_10px_rgba(139,92,246,0.35)]"
                            : "h-2.5 w-2.5 bg-violet-300/60 shadow-[0_0_8px_rgba(139,92,246,0.4)]"
                        )} />
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

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
