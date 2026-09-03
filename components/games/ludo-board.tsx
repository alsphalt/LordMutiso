"use client";

import { useMemo } from "react";
import { type GameSnapshot, COLOR_HEX } from "@/lib/games/types";
import { 
  ludoAbsCell, 
  ludoSafeCells, 
  LUDO_TRACK, 
  LUDO_HOME_COL_START, 
  LUDO_FINISH,
  legalLudoMoves,
  ludoColorForSeat,
  type LudoState,
  type LudoMove
} from "@/lib/games/ludo/engine";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface LudoBoardProps {
  snapshot: GameSnapshot;
  act: (body: any) => Promise<any>;
  isActing: boolean;
}

export function LudoBoard({ snapshot, act, isActing }: LudoBoardProps) {
  const { game, seats, mySeatNumber, isMyTurn } = snapshot;
  const state = snapshot.state as unknown as LudoState;
  const safeCells = useMemo(() => ludoSafeCells(), []);

  const legalMoves = useMemo(() => {
    if (!isMyTurn || game.status !== "PLAYING") return [];
    return legalLudoMoves(state);
  }, [state, isMyTurn, game.status]);

  const canRoll = isMyTurn && game.status === "PLAYING" && state.phase === "ROLL";

  // Coordinates for the 15x15 grid
  // 0-5: top-left base (6x6)
  // 9-14: top-right base
  // ... and so on
  
  const renderCell = (r: number, c: number) => {
    // Determine if this (r,c) is a track cell, base, or home column
    const info = getCellInfo(r, c, state);
    if (!info) return <div key={`${r}-${c}`} className="bg-transparent" />;

    const isSafe = info.type === "track" && typeof info.absIdx === "number" && safeCells.has(info.absIdx);
    const tokens = getTokensAt(r, c, state);
    
    return (
      <div
        key={`${r}-${c}`}
        className={cn(
          "relative border-[0.5px] border-black/10 flex items-center justify-center",
          info.colorClass,
          info.type === "track" && "bg-white",
          isSafe && "bg-slate-200"
        )}
      >
        {isSafe && <div className="absolute inset-0 flex items-center justify-center opacity-20"><StarIcon /></div>}
        
        {/* Tokens */}
        <div className="relative w-full h-full flex flex-wrap items-center justify-center gap-0.5 p-0.5 z-10">
          {tokens.map((t, i) => {
            const isLegal = legalMoves.some(m => m.token === t.tokenIdx && t.player === state.turn);
            return (
              <button
                key={`${t.player}-${t.tokenIdx}`}
                disabled={!isLegal || isActing}
                onClick={() => act({ action: "move", token: t.tokenIdx })}
                className={cn(
                  "w-[70%] h-[70%] rounded-full border-2 border-white shadow-md transition-all",
                  isLegal && "ring-4 ring-white animate-bounce scale-110 z-20 cursor-pointer",
                  !isLegal && "cursor-default"
                )}
                style={{ backgroundColor: COLOR_HEX[seats.find(s => s.playerNumber === t.player)?.color || "WHITE"] }}
              />
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full h-full flex flex-col gap-4">
      <div className="relative aspect-square w-full grid grid-cols-15 grid-rows-15 bg-white/5 p-1 rounded-sm shadow-2xl border-4 border-black/20">
        {/* Render 15x15 cells */}
        {Array.from({ length: 15 }).map((_, r) => 
          Array.from({ length: 15 }).map((_, c) => renderCell(r, c))
        )}

        {/* Center Overlay / Die Area */}
        <div className="absolute inset-[40%] bg-[#07030f] border-4 border-black/30 flex items-center justify-center shadow-inner z-30 overflow-hidden">
          <div className="absolute inset-0 opacity-10">
             <div className="w-full h-full grid grid-cols-2 grid-rows-2">
                <div className="bg-red-500" />
                <div className="bg-yellow-500" />
                <div className="bg-blue-500" />
                <div className="bg-green-500" />
             </div>
          </div>
          
          <div className="relative flex flex-col items-center gap-2">
             {state.die !== null && (
               <div className="animate-in zoom-in duration-300">
                 <Die value={state.die} color={COLOR_HEX[seats.find(s => s.playerNumber === state.turn)?.color || "WHITE"]} />
               </div>
             )}
             
             {canRoll && (
               <Button 
                size="sm" 
                variant="primary" 
                className="shadow-xl"
                loading={isActing}
                onClick={() => act({ action: "roll" })}
               >
                 Roll
               </Button>
             )}
          </div>
        </div>
      </div>
      
      {/* Turn Indicator */}
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
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: COLOR_HEX[seat.color] }} 
              />
              <span className="text-xs font-bold text-white uppercase tracking-wider">{seat.username}</span>
              {state.turn === seat.playerNumber && <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping" />}
            </div>
          ))}
      </div>
    </div>
  );
}

// Map grid coordinates to cell types
function getCellInfo(r: number, c: number, state: LudoState) {
  // Bases
  if (r < 6 && c < 6) return { type: "base", player: 1, colorClass: "bg-red-500/20" };
  if (r < 6 && c > 8) return { type: "base", player: 2, colorClass: "bg-yellow-500/20" };
  if (r > 8 && c > 8) return { type: "base", player: 3, colorClass: "bg-green-500/20" };
  if (r > 8 && c < 6) return { type: "base", player: 4, colorClass: "bg-blue-500/20" };

  // Center finish area (3x3)
  if (r >= 6 && r <= 8 && c >= 6 && c <= 8) return { type: "finish", colorClass: "bg-transparent" };

  // Track & Home Columns
  // This is the tricky part - mapping (r,c) to relative positions 'r' for each player
  // Standard Ludo Layout:
  // Red (1) start at (6,1). Yellow (2) start at (1,8). Green (3) start at (8,13). Blue (4) start at (13,6).
  
  // Track layout logic simplified:
  const isTrack = (r >= 6 && r <= 8) || (c >= 6 && c <= 8);
  if (!isTrack) return null;

  // Map each cell in the cross to an absolute track index or home column
  const trackIdx = getTrackIndex(r, c);
  if (trackIdx !== null) {
     // Check if it's a home column cell
     const homeCol = getHomeColInfo(r, c);
     if (homeCol) {
       return { type: "home", player: homeCol.player, colorClass: homeCol.colorClass };
     }
     return { type: "track", absIdx: trackIdx, colorClass: "" };
  }

  return null;
}

function getTrackIndex(r: number, c: number): number | null {
  // 15x15 grid, cross is at row 6,7,8 and col 6,7,8
  const crossCells: [number, number][] = [
    // Top arm (cols 6,7,8, rows 0-5)
    [0,6], [1,6], [2,6], [3,6], [4,6], [5,6],
    [0,7], [1,7], [2,7], [3,7], [4,7], [5,7],
    [0,8], [1,8], [2,8], [3,8], [4,8], [5,8],
    // Right arm (rows 6,7,8, cols 9-14)
    [6,9], [6,10], [6,11], [6,12], [6,13], [6,14],
    [7,9], [7,10], [7,11], [7,12], [7,13], [7,14],
    [8,9], [8,10], [8,11], [8,12], [8,13], [8,14],
    // Bottom arm (cols 6,7,8, rows 9-14)
    [9,8], [10,8], [11,8], [12,8], [13,8], [14,8],
    [9,7], [10,7], [11,7], [12,7], [13,7], [14,7],
    [9,6], [10,6], [11,6], [12,6], [13,6], [14,6],
    // Left arm (rows 6,7,8, cols 0-5)
    [8,5], [8,4], [8,3], [8,2], [8,1], [8,0],
    [7,5], [7,4], [7,3], [7,2], [7,1], [7,0],
    [6,5], [6,4], [6,3], [6,2], [6,1], [6,0]
  ];

  // The 52 track cells are specific ones in this cross
  // Order for abs index 0..51 (starting from Red's start at (6,1))
  const trackPath: [number, number][] = [
    [6,1], [6,2], [6,3], [6,4], [6,5],
    [5,6], [4,6], [3,6], [2,6], [1,6], [0,6], [0,7], [0,8],
    [1,8], [2,8], [3,8], [4,8], [5,8],
    [6,9], [6,10], [6,11], [6,12], [6,13], [6,14], [7,14], [8,14],
    [8,13], [8,12], [8,11], [8,10], [8,9],
    [9,8], [10,8], [11,8], [12,8], [13,8], [14,8], [14,7], [14,6],
    [13,6], [12,6], [11,6], [10,6], [9,6],
    [8,5], [8,4], [8,3], [8,2], [8,1], [8,0], [7,0], [6,0]
  ];

  const idx = trackPath.findIndex(p => p[0] === r && p[1] === c);
  if (idx !== -1) return idx;

  // Home columns (middle cells of each arm)
  // These are not in trackPath
  return null;
}

function getHomeColInfo(r: number, c: number) {
  if (c === 7 && r >= 1 && r <= 6) return { player: 2, colorClass: "bg-yellow-500/40" };
  if (r === 7 && c >= 8 && c <= 13) return { player: 3, colorClass: "bg-green-500/40" };
  if (c === 7 && r >= 8 && r <= 13) return { player: 4, colorClass: "bg-blue-500/40" };
  if (r === 7 && c >= 1 && c <= 6) return { player: 1, colorClass: "bg-red-500/40" };
  return null;
}

function getTokensAt(r: number, c: number, state: LudoState) {
  const found: { player: number; tokenIdx: number }[] = [];
  
  // Base tokens
  if (r < 6 && c < 6) { // Base 1
    const p = 1; if (state.tokens[p]) state.tokens[p].forEach((rel, i) => { if (rel === -1 && isAtBasePos(p, i, r, c)) found.push({ player: p, tokenIdx: i }); });
  } else if (r < 6 && c > 8) { // Base 2
    const p = 2; if (state.tokens[p]) state.tokens[p].forEach((rel, i) => { if (rel === -1 && isAtBasePos(p, i, r, c)) found.push({ player: p, tokenIdx: i }); });
  } else if (r > 8 && c > 8) { // Base 3
    const p = 3; if (state.tokens[p]) state.tokens[p].forEach((rel, i) => { if (rel === -1 && isAtBasePos(p, i, r, c)) found.push({ player: p, tokenIdx: i }); });
  } else if (r > 8 && c < 6) { // Base 4
    const p = 4; if (state.tokens[p]) state.tokens[p].forEach((rel, i) => { if (rel === -1 && isAtBasePos(p, i, r, c)) found.push({ player: p, tokenIdx: i }); });
  }

  // Finish tokens
  if (r >= 6 && r <= 8 && c >= 6 && c <= 8) {
    Object.entries(state.tokens).forEach(([pStr, tokens]) => {
      const p = parseInt(pStr);
      tokens.forEach((rel, i) => { if (rel === LUDO_FINISH) found.push({ player: p, tokenIdx: i }); });
    });
  }

  // Track & Home column tokens
  const absIdx = getTrackIndex(r, c);
  const homeInfo = getHomeColInfo(r, c);

  Object.entries(state.tokens).forEach(([pStr, tokens]) => {
    const p = parseInt(pStr);
    const colorIdx = p - 1;
    tokens.forEach((rel, i) => {
      if (rel >= 0 && rel <= 50) {
        if (ludoAbsCell(colorIdx, rel) === absIdx) found.push({ player: p, tokenIdx: i });
      } else if (rel > 50 && rel < 56 && homeInfo && homeInfo.player === p) {
        // rel 51..55 correspond to home col squares 1..5 (index 7 row/col)
        // Red (1): r=7, c=1..6 (rel 51..56) -> rel 51 is c=1, 52 is c=2, ...
        // Yellow (2): c=7, r=1..6 -> rel 51 is r=1, 52 is r=2, ...
        // Green (3): r=7, c=13..8 -> rel 51 is c=13, 52 is c=12, ...
        // Blue (4): c=7, r=13..8 -> rel 51 is r=13, 52 is r=12, ...
        let matches = false;
        if (p === 1 && c === rel - 50) matches = true;
        else if (p === 2 && r === rel - 50) matches = true;
        else if (p === 3 && c === 14 - (rel - 50)) matches = true;
        else if (p === 4 && r === 14 - (rel - 50)) matches = true;
        
        if (matches) found.push({ player: p, tokenIdx: i });
      }
    });
  });

  return found;
}

function isAtBasePos(p: number, tokenIdx: number, r: number, c: number) {
  // Simple 2x2 grid inside 6x6 base
  const offsets = [[2, 2], [2, 3], [3, 2], [3, 3]];
  const [dr, dc] = offsets[tokenIdx];
  let baseR = 0, baseC = 0;
  if (p === 1) { baseR = 0; baseC = 0; }
  else if (p === 2) { baseR = 0; baseC = 9; }
  else if (p === 3) { baseR = 9; baseC = 9; }
  else if (p === 4) { baseR = 9; baseC = 0; }
  return r === baseR + dr && c === baseC + dc;
}

function StarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
      <path d="M12 .587l3.668 7.431 8.332 1.21-6.001 5.85 1.416 8.265L12 18.896l-7.415 3.897 1.416-8.265-6.001-5.85 8.332-1.21z" />
    </svg>
  );
}

function Die({ value, color }: { value: number; color: string }) {
  const dots = [
    [],
    [4], // 1
    [0, 8], // 2
    [0, 4, 8], // 3
    [0, 2, 6, 8], // 4
    [0, 2, 4, 6, 8], // 5
    [0, 2, 3, 5, 6, 8], // 6
  ][value];

  return (
    <div 
      className="w-12 h-12 rounded-xl flex items-center justify-center p-2 shadow-xl"
      style={{ backgroundColor: color }}
    >
      <div className="grid grid-cols-3 grid-rows-3 w-full h-full gap-1">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="flex items-center justify-center">
            {dots.includes(i) && <div className="w-2 h-2 rounded-full bg-white shadow-sm" />}
          </div>
        ))}
      </div>
    </div>
  );
}
