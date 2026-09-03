"use client";

import * as React from "react";
import { AuthContext, AuthContextType } from "@/components/providers/auth-provider";

export function useAuth(): AuthContextType {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
