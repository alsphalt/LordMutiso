"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "flex h-11 w-full rounded-xl bg-white/[0.05] border border-white/10 px-4 py-2 text-sm text-white placeholder:text-slate-500 focus-ring transition-all hover:bg-white/[0.08]",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "flex min-h-[80px] w-full rounded-xl bg-white/[0.05] border border-white/10 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus-ring transition-all hover:bg-white/[0.08] resize-none",
        className
      )}
      {...props}
    />
  )
);
Textarea.displayName = "Textarea";

export function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5 w-full">
      <label className="text-sm font-medium text-slate-300 ml-1">{label}</label>
      {children}
      {error ? (
        <p className="text-xs text-rose-400 ml-1">{error}</p>
      ) : hint ? (
        <p className="text-xs text-slate-500 ml-1">{hint}</p>
      ) : null}
    </div>
  );
}
