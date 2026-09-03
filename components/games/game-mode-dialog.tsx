"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Users, Bot, Play, ChevronRight } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api } from "@/hooks/api";
import { useToast } from "@/components/ui/toast";
import { 
  GameTypeName, 
  ludoColorsFor, 
  COLOR_LABEL, 
  COLOR_HEX, 
  ColorName,
  AiDifficultyName 
} from "@/lib/games/types";
import { cn } from "@/lib/utils";

interface GameModeDialogProps {
  open: boolean;
  onClose: () => void;
  type: GameTypeName;
}

export function GameModeDialog({ open, onClose, type }: GameModeDialogProps) {
  const router = useRouter();
  const { push } = useToast();
  const [mode, setMode] = React.useState<"ONLINE" | "AI" | null>(null);
  const [loading, setLoading] = React.useState(false);

  // AI Config State
  const [aiCount, setAiCount] = React.useState<number>(1); // Ludo only
  const [difficulty, setDifficulty] = React.useState<AiDifficultyName>("MEDIUM");
  const [colorSelection, setColorSelection] = React.useState<ColorName | "RANDOM">("RANDOM");

  // Reset state when opening/closing/changing type
  React.useEffect(() => {
    if (open) {
      setMode(null);
      setAiCount(1);
      setDifficulty("MEDIUM");
      setColorSelection("RANDOM");
    }
  }, [open, type]);

  const handlePlayOnline = () => {
    router.push(`/lobby?type=${type}`);
    onClose();
  };

  const handlePlayAi = async () => {
    setLoading(true);
    try {
      let finalColor: ColorName;
      if (colorSelection === "RANDOM") {
        if (type === "LUDO") {
          const colors = ludoColorsFor(aiCount + 1);
          finalColor = colors[Math.floor(Math.random() * colors.length)];
        } else {
          finalColor = Math.random() > 0.5 ? "WHITE" : "BLACK";
        }
      } else {
        finalColor = colorSelection as ColorName;
      }

      const body = {
        type,
        difficulty,
        color: finalColor,
        ...(type === "LUDO" ? { aiCount } : {}),
      };

      const data = await api<{ ok: boolean; gameId: string }>("/api/ai", {
        method: "POST",
        body: JSON.stringify(body),
      });

      if (data.ok) {
        router.push(`/play/${data.gameId}`);
        onClose();
      }
    } catch (err: any) {
      push({
        title: "Error",
        message: err.message || "Failed to start AI game",
        tone: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const ludoColors = ludoColorsFor(aiCount + 1);

  return (
    <Modal open={open} onClose={onClose} title="CHOOSE GAME MODE">
      <div className="space-y-4">
        {/* Play with People */}
        <div className="cursor-pointer" onClick={() => setMode("ONLINE")}>
        <Card
          className={cn(
            "p-5 transition-all border-2 border-transparent hover:border-white/10",
            mode === "ONLINE" && "bg-white/5 border-arena-purple/30"
          )}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                <Users size={24} />
              </div>
              <div>
                <h3 className="font-black italic uppercase tracking-wider text-white">👥 PLAY WITH PEOPLE</h3>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-0.5">Multiplayer online game</p>
              </div>
            </div>
            {mode === "ONLINE" && <Badge tone="purple">SELECTED</Badge>}
          </div>
          
          {mode === "ONLINE" && (
            <div className="mt-6 animate-in fade-in slide-in-from-top-2 duration-300">
              <Button full onClick={handlePlayOnline} className="italic font-black tracking-[0.2em] gap-2">
                PLAY ONLINE <ChevronRight size={18} />
              </Button>
            </div>
          )}
        </Card>
        </div>

        {/* Play with AI */}
        <div className="cursor-pointer" onClick={() => setMode("AI")}>
        <Card
          className={cn(
            "p-5 transition-all border-2 border-transparent hover:border-white/10",
            mode === "AI" && "bg-white/5 border-cyan-500/30"
          )}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 flex items-center justify-center text-cyan-400">
                <Bot size={24} />
              </div>
              <div>
                <h3 className="font-black italic uppercase tracking-wider text-white">🤖 PLAY WITH AI</h3>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-0.5">Practice against computer</p>
              </div>
            </div>
            {mode === "AI" && <Badge tone="cyan">SELECTED</Badge>}
          </div>

          {mode === "AI" && (
            <div className="mt-8 space-y-6 animate-in fade-in slide-in-from-top-4 duration-300 cursor-default" onClick={(e) => e.stopPropagation()}>
              
              {/* LUDO: AI Count */}
              {type === "LUDO" && (
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">AI Opponents</label>
                  <div className="flex gap-2">
                    {[1, 2, 3].map((n) => (
                      <button
                        key={n}
                        onClick={() => {
                          setAiCount(n);
                          setColorSelection("RANDOM"); // Reset color when opponent count changes
                        }}
                        className={cn(
                          "flex-1 min-h-[48px] rounded-xl font-black italic border-2 transition-all active:scale-95",
                          aiCount === n 
                            ? "bg-cyan-500/20 border-cyan-500 text-cyan-400" 
                            : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10"
                        )}
                      >
                        🤖 {n}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Color Selection */}
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                  {type === "LUDO" ? "Your Color" : "Play As"}
                </label>
                <div className="flex flex-wrap gap-2">
                  {type === "LUDO" ? (
                    ludoColors.map((c) => (
                      <button
                        key={c}
                        onClick={() => setColorSelection(c)}
                        className={cn(
                          "flex-1 min-h-[48px] px-3 rounded-xl border-2 transition-all flex items-center justify-center gap-2 active:scale-95",
                          colorSelection === c
                            ? "bg-white/10 border-white/40"
                            : "bg-white/5 border-white/5 hover:border-white/10"
                        )}
                      >
                        <span className="w-3 h-3 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.5)]" style={{ backgroundColor: COLOR_HEX[c] }} />
                        <span className={cn(
                          "text-[10px] font-black uppercase tracking-widest",
                          colorSelection === c ? "text-white" : "text-slate-500"
                        )}>
                          {COLOR_LABEL[c]}
                        </span>
                      </button>
                    ))
                  ) : (
                    <>
                      <button
                        onClick={() => setColorSelection("WHITE")}
                        className={cn(
                          "flex-1 min-h-[48px] rounded-xl border-2 transition-all flex flex-col items-center justify-center active:scale-95",
                          colorSelection === "WHITE" ? "bg-white/20 border-white" : "bg-white/5 border-white/5"
                        )}
                      >
                        <span className="text-xl">♔</span>
                        <span className="text-[9px] font-black uppercase tracking-tighter">WHITE</span>
                      </button>
                      <button
                        onClick={() => setColorSelection("BLACK")}
                        className={cn(
                          "flex-1 min-h-[48px] rounded-xl border-2 transition-all flex flex-col items-center justify-center active:scale-95",
                          colorSelection === "BLACK" ? "bg-slate-800 border-slate-600" : "bg-white/5 border-white/5"
                        )}
                      >
                        <span className="text-xl">♟</span>
                        <span className="text-[9px] font-black uppercase tracking-tighter">BLACK</span>
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => setColorSelection("RANDOM")}
                    className={cn(
                      "flex-1 min-h-[48px] rounded-xl border-2 transition-all flex flex-col items-center justify-center active:scale-95",
                      colorSelection === "RANDOM" ? "bg-indigo-500/20 border-indigo-500 text-indigo-400" : "bg-white/5 border-white/5 text-slate-500"
                    )}
                  >
                    <span className="text-lg">🎲</span>
                    <span className="text-[9px] font-black uppercase tracking-tighter">RANDOM</span>
                  </button>
                </div>
              </div>

              {/* Difficulty */}
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">AI Difficulty</label>
                <div className="flex gap-2">
                  {(["EASY", "MEDIUM", "HARD"] as AiDifficultyName[]).map((d) => (
                    <button
                      key={d}
                      onClick={() => setDifficulty(d)}
                      className={cn(
                        "flex-1 min-h-[44px] rounded-xl text-[10px] font-black uppercase tracking-widest border-2 transition-all flex items-center justify-center gap-1.5 active:scale-95",
                        difficulty === d
                          ? d === "EASY" ? "bg-emerald-500/20 border-emerald-500 text-emerald-400"
                            : d === "MEDIUM" ? "bg-amber-500/20 border-amber-500 text-amber-400"
                            : "bg-rose-500/20 border-rose-500 text-rose-400"
                          : "bg-white/5 border-white/5 text-slate-500"
                      )}
                    >
                      <span className={cn(
                        "w-1.5 h-1.5 rounded-full",
                        d === "EASY" ? "bg-emerald-500" : d === "MEDIUM" ? "bg-amber-500" : "bg-rose-500"
                      )} />
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4">
                <Button 
                  full 
                  loading={loading}
                  onClick={handlePlayAi}
                  variant="success"
                  className="h-14 italic font-black tracking-[0.2em] gap-3"
                >
                  <Play size={20} fill="currentColor" /> PLAY WITH AI
                </Button>
              </div>
            </div>
          )}
        </Card>
        </div>
      </div>
    </Modal>
  );
}
