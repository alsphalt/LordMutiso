"use client";

import * as React from "react";
import { X, CheckCircle2, AlertCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastTone = "success" | "error" | "info";

export interface Toast {
  id: string;
  title?: string;
  message: string;
  tone?: ToastTone;
}

const ToastContext = React.createContext<{
  push: (toast: Omit<Toast, "id">) => void;
} | null>(null);

export function useToast() {
  const context = React.useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within ToastProvider");
  return context;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const push = React.useCallback(({ title, message, tone = "info" }: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, title, message, tone }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="fixed bottom-0 right-0 z-[100] p-4 space-y-3 w-full max-w-md">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              "glass-strong p-4 animate-slide-up flex gap-3 shadow-2xl border-l-4",
              toast.tone === "success" && "border-l-emerald-500",
              toast.tone === "error" && "border-l-rose-500",
              toast.tone === "info" && "border-l-cyan-500"
            )}
          >
            <div className="shrink-0 mt-0.5">
              {toast.tone === "success" && <CheckCircle2 size={18} className="text-emerald-400" />}
              {toast.tone === "error" && <AlertCircle size={18} className="text-rose-400" />}
              {toast.tone === "info" && <Info size={18} className="text-cyan-400" />}
            </div>
            <div className="flex-1 min-w-0">
              {toast.title && <p className="text-sm font-bold text-white mb-0.5">{toast.title}</p>}
              <p className="text-sm text-slate-300 leading-relaxed">{toast.message}</p>
            </div>
            <button
              onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
              className="shrink-0 text-slate-500 hover:text-white transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
