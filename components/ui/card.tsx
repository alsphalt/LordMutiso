"use client";

import { cn } from "@/lib/utils";

export function Card({ className, children, glow }: { className?: string; children: React.ReactNode; glow?: boolean }) {
  return (
    <div className={cn("glass overflow-hidden", glow && "shadow-glow", className)}>
      {children}
    </div>
  );
}
