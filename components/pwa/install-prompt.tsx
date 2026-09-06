"use client";

import * as React from "react";
import { X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const LS_KEY = "dn_pwa_prompt";
const isStandalone = () =>
  window.matchMedia?.("(display-mode: standalone)").matches ||
  (navigator as unknown as { standalone?: boolean }).standalone === true;

/**
 * PWA install prompt — shows once, respects installed state, uses the native
 * browser install flow when supported and falls back to "Add to Home Screen"
 * instructions on iOS / browsers without a native prompt.
 */
export function InstallPrompt() {
  const [deferred, setDeferred] = React.useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = React.useState(false);
  const [mode, setMode] = React.useState<"native" | "manual">("native");
  const suppressed = React.useRef(false);

  // Service-worker registration (production only).
  React.useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  // Listen for the native install availability + installed events.
  React.useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      const ev = e as BeforeInstallPromptEvent;
      setDeferred(ev);
      setMode("native");
      maybeShow();
    };
    const onInstalled = () => {
      suppressed.current = true;
      localStorage.setItem(LS_KEY, "installed");
      setVisible(false);
    };
    const tryLater = () => {
      const ios =
        /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
      if (isStandalone()) return;
      if (localStorage.getItem(LS_KEY)) return; // dismissed / installed before
      // Browsers that don't support beforeinstallprompt (iOS Safari, some
      // Android webviews) get the "Add to Home Screen" instructions instead.
      if (ios) {
        setMode("manual");
        setVisible(true);
      }
    };
    const maybeShow = () => {
      if (isStandalone() || localStorage.getItem(LS_KEY)) return;
      const t = setTimeout(() => setVisible(true), 900);
      return () => clearTimeout(t);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    if (!deferred) tryLater();
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deferred]);

  const close = () => {
    setVisible(false);
    if (!suppressed.current) localStorage.setItem(LS_KEY, "1");
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === "accepted") {
      suppressed.current = true;
      localStorage.setItem(LS_KEY, "installed");
    }
    setDeferred(null);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[90] flex justify-center px-3">
      <div className="pointer-events-auto mb-4 flex w-full max-w-sm items-center gap-3 rounded-2xl border border-white/12 bg-[#150e28]/95 p-3 shadow-[0_18px_50px_-12px_rgba(124,58,237,0.6)] backdrop-blur-xl"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-192.png" alt="" className="h-14 w-14 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-white">DARKNOTE GAMING ARENA</p>
          {mode === "native" ? (
            <p className="text-xs text-slate-400">Install the app for a faster app-like experience.</p>
          ) : (
            <p className="text-xs leading-snug text-slate-400">
              Tap <span className="font-semibold text-slate-200">Share</span> then{" "}
              <span className="font-semibold text-slate-200">Add to Home Screen</span> to install.
            </p>
          )}
          <div className="mt-2 flex items-center gap-2">
            <button
              onClick={mode === "native" ? () => void install() : close}
              className="rounded-lg bg-gradient-to-r from-violet-600 to-cyan-500 px-4 py-1.5 text-xs font-bold text-white active:scale-95"
            >
              {mode === "native" ? "INSTALL" : "GOT IT"}
            </button>
            <button onClick={close} className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-white">
              NOT NOW
            </button>
          </div>
        </div>
        <button onClick={close} aria-label="Close" className="self-start text-slate-500 hover:text-white">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
