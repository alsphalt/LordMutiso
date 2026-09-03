"use client";

import { cn } from "@/lib/utils";

export type BadgeTone = "purple" | "cyan" | "green" | "rose" | "amber" | "slate";

export function Badge({ tone = "slate", children, className }: { tone?: BadgeTone; children: React.ReactNode; className?: string }) {
  const tones = {
    purple: "bg-violet-500/10 text-violet-400 border-violet-500/20",
    cyan: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
    green: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    rose: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    amber: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    slate: "bg-slate-500/10 text-slate-400 border-slate-500/20",
  };

  return (
    <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-medium border", tones[tone], className)}>
      {children}
    </span>
  );
}
