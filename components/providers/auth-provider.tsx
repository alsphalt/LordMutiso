"use client";

import * as React from "react";
import { AuthUser } from "@/lib/auth-types";
import { api } from "@/hooks/api";
import { useRouter } from "next/navigation";

export interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = React.createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<AuthUser | null>(null);
  const [loading, setLoading] = React.useState(true);
  const router = useRouter();

  const refresh = React.useCallback(async () => {
    try {
      const data = await api<{ user: AuthUser | null }>("/api/auth/me");
      setUser(data.user);
    } catch (err) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = React.useCallback(async () => {
    try {
      await api("/api/auth/logout", { method: "POST" });
      setUser(null);
      router.replace("/login");
    } catch (err) {
      // even on error, clear local state
      setUser(null);
      router.replace("/login");
    }
  }, [router]);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <AuthContext.Provider value={{ user, loading, refresh, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
