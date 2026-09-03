"use client";

import { useState, useEffect } from "react";

export function useCountdown(targetMs: number | null, tick = 1000) {
  const [remaining, setRemaining] = useState<number>(0);

  useEffect(() => {
    if (!targetMs) {
      setRemaining(0);
      return;
    }

    const calculate = () => {
      const now = Date.now();
      const diff = Math.max(0, targetMs - now);
      setRemaining(diff);
      return diff;
    };

    calculate();
    const interval = setInterval(() => {
      const diff = calculate();
      if (diff <= 0) clearInterval(interval);
    }, tick);

    return () => clearInterval(interval);
  }, [targetMs, tick]);

  return remaining;
}
