"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/hooks/api";
import type { GameSnapshot } from "@/lib/games/types";
import { useToast } from "@/components/ui/toast";

export function useGame(gameId: string) {
  const router = useRouter();
  const { push: toast } = useToast();
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  
  const actingRef = useRef(false);
  const lastPollRef = useRef(0);

  const fetchSnapshot = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true);
    try {
      const data = await api<{ snapshot: GameSnapshot }>(`/api/games/${gameId}`);
      setSnapshot(data.snapshot);
      setError(null);
    } catch (err: any) {
      console.error("Failed to fetch game snapshot:", err);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      if (isInitial) setLoading(false);
    }
  }, [gameId]);

  // Polling
  useEffect(() => {
    let timer: NodeJS.Timeout;
    
    const poll = async () => {
      const now = Date.now();
      if (
        !document.hidden && 
        !actingRef.current && 
        now - lastPollRef.current >= 1500
      ) {
        lastPollRef.current = now;
        await fetchSnapshot();
      }
      timer = setTimeout(poll, 500); // Check every 500ms if we should poll
    };

    poll();
    return () => clearTimeout(timer);
  }, [fetchSnapshot]);

  // Heartbeat
  useEffect(() => {
    const heartbeat = () => {
      api("/api/heartbeat", { method: "POST" }).catch(() => {});
    };
    heartbeat();
    const interval = setInterval(heartbeat, 30000);
    return () => clearInterval(interval);
  }, []);

  const act = async (body: any) => {
    setActing(true);
    actingRef.current = true;
    try {
      const res = await api<any>(`/api/games/${gameId}/action`, {
        method: "POST",
        body: JSON.stringify(body),
      });

      if (res.newGameId) {
        router.push(`/play/${res.newGameId}`);
      } else if (res.snapshot) {
        setSnapshot(res.snapshot);
      } else {
        // Fallback refresh
        await fetchSnapshot();
      }
      return res;
    } catch (err: any) {
      const msg = err.message || "Action failed";
      toast({ title: "Action failed", message: msg, tone: "error" });
      // Refresh state on error to ensure we are in sync
      await fetchSnapshot();
      throw err;
    } finally {
      setActing(false);
      actingRef.current = false;
    }
  };

  return {
    snapshot,
    error,
    loading: loading || (acting && !snapshot),
    refresh: fetchSnapshot,
    act,
    isActing: acting
  };
}
