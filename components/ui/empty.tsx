"use client";

import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({ icon: Icon, title, message, action }: { icon?: LucideIcon; title: string; message?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center glass border-dashed">
      {Icon && (
        <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-4 text-slate-400">
          <Icon size={24} />
        </div>
      )}
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      {message && <p className="mt-1 text-sm text-slate-400 max-w-xs">{message}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
