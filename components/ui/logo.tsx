"use client";

import { cn } from "@/lib/utils";
import { Gamepad2 } from "lucide-react";

export function Logo({ size = "md", className }: { size?: "sm" | "md" | "lg"; className?: string }) {
  const sizes = {
    sm: "text-lg",
    md: "text-2xl",
    lg: "text-4xl",
  };
  
  const iconSizes = {
    sm: 20,
    md: 28,
    lg: 40,
  };

  return (
    <div className={cn("flex items-center gap-2 font-bold tracking-tight text-white", sizes[size], className)}>
      <div className={cn("flex items-center justify-center bg-gradient-to-br from-violet-500 to-indigo-600 rounded-lg shadow-glow", 
        size === "sm" ? "p-1" : size === "md" ? "p-1.5" : "p-2")}>
        <Gamepad2 size={iconSizes[size]} className="text-white" />
      </div>
      <span>
        DARKNOTE<span className="text-cyan-400">ARENA</span>
      </span>
    </div>
  );
}
