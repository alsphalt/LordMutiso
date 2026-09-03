"use client";

import { cn } from "@/lib/utils";

export function Stat({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="glass p-5">
      <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</p>
      <p className={cn("mt-2 text-2xl font-bold", accent && "text-gradient")}>
        {value}
      </p>
    </div>
  );
}
