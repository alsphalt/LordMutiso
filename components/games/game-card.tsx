"use client";

import { GameTypeName, GAME_TYPES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";

export function GameCard({ type, onPlay }: { type: GameTypeName; onPlay: () => void }) {
  const meta = GAME_TYPES[type];
  
  const styles: Record<GameTypeName, string> = {
    LUDO: "from-rose-500/20 to-orange-500/20 border-rose-500/30 text-rose-400",
    CHESS: "from-indigo-500/20 to-violet-500/20 border-indigo-500/30 text-indigo-400",
    CHECKERS: "from-emerald-500/20 to-teal-500/20 border-emerald-500/30 text-emerald-400",
    TICTACTOE: "from-cyan-500/20 to-sky-500/20 border-cyan-500/30 text-cyan-400",
    WALLRUSH: "from-amber-500/20 to-orange-500/20 border-amber-500/30 text-amber-400",
  };

  return (
    <div className={cn(
      "group relative overflow-hidden rounded-3xl border-2 p-1 transition-all hover:scale-[1.02] active:scale-[0.98]",
      styles[type]
    )}>
      <div className="absolute inset-0 bg-gradient-to-br opacity-50 group-hover:opacity-80 transition-opacity" />
      
      <div className="relative glass-strong rounded-[22px] p-6 h-full flex flex-col items-center text-center">
        <div className="mb-4 text-6xl drop-shadow-2xl animate-bounce-slow">
          {meta.emoji}
        </div>
        
        <h3 className="text-2xl font-black tracking-tight text-white uppercase italic">
          {meta.label}
        </h3>
        
        <p className="mt-2 text-sm text-slate-400 leading-tight min-h-[40px]">
          {meta.tagline}
        </p>

        <div className="mt-6 w-full space-y-3">
          <div className="flex items-center justify-center gap-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">
            <span>{meta.minPlayers}-{meta.maxPlayers} Players</span>
            <span className="w-1 h-1 rounded-full bg-white/20" />
            <span>Multiplayer</span>
          </div>

          <Button full variant="primary" onClick={onPlay} className="h-12 text-sm font-black italic tracking-widest gap-2">
            PLAY NOW <ChevronRight size={18} />
          </Button>
        </div>
      </div>

      <style jsx>{`
        @keyframes bounce-slow {
          0%, 100% { transform: translateY(-5%); }
          50% { transform: translateY(5%); }
        }
        .animate-bounce-slow {
          animation: bounce-slow 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
