"use client";

import { avatarFor } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function Avatar({ username, src, size = 36, className }: { username: string; src?: string | null; size?: number; className?: string }) {
  const url = src || avatarFor(username);
  
  return (
    <div 
      className={cn("relative shrink-0 rounded-full overflow-hidden bg-white/5 border border-white/10", className)}
      style={{ width: size, height: size }}
    >
      <img
        src={url}
        alt={username}
        className="w-full h-full object-cover"
        onError={(e) => {
          (e.target as HTMLImageElement).src = avatarFor(username);
        }}
      />
    </div>
  );
}
