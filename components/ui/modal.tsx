"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

export function Modal({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title?: string; children: React.ReactNode; footer?: React.ReactNode }) {
  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-arena-950/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg glass-strong shadow-2xl animate-pop-in flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-6 pb-2">
          {title ? <h2 className="text-xl font-bold">{title}</h2> : <div />}
          <Button variant="ghost" size="xs" onClick={onClose} className="rounded-full h-8 w-8 p-0">
            <X size={18} />
          </Button>
        </div>
        
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
          {children}
        </div>

        {footer && (
          <div className="p-6 pt-2 border-t border-white/10 flex justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
