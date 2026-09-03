"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export class ApiClientError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = "ApiClientError";
  }
}

/** JSON fetch helper with cache:no-store. */
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  const data = await res.json();
  if (!res.ok) {
    throw new ApiClientError(data.error || "Something went wrong", res.status);
  }

  return data;
}

/** Polling hook with cleanup and window focus refetching. */
export function useApiPoll<T>(
  path: string,
  intervalMs: number,
  options: { enabled?: boolean; refetchOnFocus?: boolean } = {}
) {
  const { enabled = true, refetchOnFocus = true } = options;
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiClientError | null>(null);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<NodeJS.Timeout>();

  const refresh = useCallback(async () => {
    try {
      const result = await api<T>(path);
      setData(result);
      setError(null);
    } catch (err) {
      setError(err as ApiClientError);
    } finally {
      setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    if (!enabled) return;

    refresh();
    timerRef.current = setInterval(refresh, intervalMs);

    const handleFocus = () => {
      if (refetchOnFocus) refresh();
    };

    window.addEventListener("focus", handleFocus);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      window.removeEventListener("focus", handleFocus);
    };
  }, [enabled, intervalMs, refresh, refetchOnFocus]);

  return { data, error, loading, refresh };
}
