"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

import { clearAuthToken, getAuthToken, setAuthToken } from "@/lib/auth-storage";
import { getMe, type AuthUser } from "@/services/auth";

export type Role = "customer" | "shop_owner";

interface AuthenticationContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  loginUser: (user: AuthUser, token: string) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthenticationContext = createContext<AuthenticationContextType | null>(null);

const CACHED_USER_KEY = "EXPIRYGO_CACHED_USER";

export function AuthenticationProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const token = getAuthToken();
    if (!token) {
      setUser(null);
      return;
    }
    try {
      const me = await getMe();
      setUser(me);
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(CACHED_USER_KEY, JSON.stringify(me));
        } catch {}
      }
    } catch {
      // If server session is invalid or user was removed, clear all cached session artifacts
      if (typeof window !== "undefined") {
        try {
          localStorage.removeItem(CACHED_USER_KEY);
        } catch {}
      }
      clearAuthToken();
      setUser(null);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await refreshUser();
      setIsLoading(false);
    })();
  }, [refreshUser]);

  const loginUser = useCallback((authUser: AuthUser, token: string) => {
    setAuthToken(token);
    setUser(authUser);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(CACHED_USER_KEY, JSON.stringify(authUser));
      } catch {}
    }
  }, []);

  const logout = useCallback(() => {
    clearAuthToken();
    setUser(null);
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem(CACHED_USER_KEY);
      } catch {}
    }
  }, []);

  return (
    <AuthenticationContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        loginUser,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthenticationContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthenticationContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthenticationProvider");
  }
  return ctx;
}
