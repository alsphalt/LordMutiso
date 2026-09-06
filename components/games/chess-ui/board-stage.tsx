"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * BoardStage — premium presentation frame for a game board.
 *
 * Layered, roughly concentric surfaces (outside → inside):
 *   1. soft purple/cyan ambient glow bleeding around the whole stage
 *   2. dark polished wood outer frame (layered bevel + deep soft drop shadows)
 *   3. warm bevel rim (light catching the chamfer)
 *   4. near-black felt inset with a faint purple hairline
 *   5. the actual board surface (children), softly clipped at the corners
 *
 * The stage keeps a perfect aspect-square outline and is fully
 * presentation-only: children keep their own layout, sizing and logic.
 */
export function BoardStage({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("relative aspect-square w-full", className)}>
      {/* 1 — ambient glow around the frame (purple top-left, cyan bottom-right) */}
      <div
        aria-hidden
        className="absolute -inset-[4%] rounded-[10%] opacity-70 blur-2xl"
        style={{
          background:
            "radial-gradient(58% 58% at 26% 18%, rgba(139,92,246,0.30), transparent 70%), radial-gradient(52% 52% at 78% 84%, rgba(34,211,238,0.20), transparent 70%)",
        }}
      />

      {/* 2 — dark polished wood outer frame */}
      <div
        aria-hidden
        className="absolute inset-0 rounded-[7%] p-[1.6%]"
        style={{
          background:
            "radial-gradient(130% 100% at 16% 8%, rgba(255,214,166,0.28), rgba(255,214,166,0) 42%), radial-gradient(120% 120% at 85% 100%, rgba(0,0,0,0.55), transparent 60%), linear-gradient(135deg, #4a2d1a 0%, #33200f 32%, #221207 62%, #170b03 100%)",
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -3px 8px rgba(0,0,0,0.6), 0 2px 0 #1c0f06, 0 10px 18px rgba(0,0,0,0.55), 0 26px 60px -12px rgba(0,0,0,0.85)",
        }}
      />

      {/* 3 — warm bevel rim catching the light */}
      <div
        aria-hidden
        className="absolute inset-[1.6%] rounded-[5.6%] p-[1.1%]"
        style={{
          background:
            "linear-gradient(155deg, #e8c088 0%, #a97a49 14%, #6b4a2a 34%, #3c2716 55%, #553619 78%, #c1915c 100%)",
          boxShadow:
            "0 0 0 1px rgba(255,255,255,0.07), inset 0 1px 3px rgba(255,240,220,0.5), inset 0 -3px 6px rgba(0,0,0,0.65)",
        }}
      />

      {/* 4 — dark felt inset with a faint purple hairline */}
      <div
        aria-hidden
        className="absolute inset-[2.7%] rounded-[4.4%] p-[1%]"
        style={{
          background: "linear-gradient(155deg, #261542 0%, #150b2b 45%, #0a0518 100%)",
          boxShadow:
            "inset 0 3px 12px rgba(0,0,0,0.9), 0 0 0 1px rgba(139,92,246,0.22), 0 0 30px -4px rgba(124,58,237,0.35)",
        }}
      />

      {/* 5 — board seat */}
      <div className="absolute inset-[3.7%] overflow-hidden rounded-[3%] ring-1 ring-white/10 shadow-[0_0_0_1px_rgba(0,0,0,0.4),0_0_26px_-2px_rgba(34,211,238,0.12)]">
        {children}
      </div>
    </div>
  );
}
