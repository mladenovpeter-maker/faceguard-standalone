import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { setAuthTokenGetter } from "@workspace/api-client-react";

export type UserRole = "admin" | "operator";

export interface AuthUser {
  id: number;
  username: string;
  role: UserRole;
  displayName: string | null;
}

interface AuthCtx {
  user: AuthUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  changePassword: (current: string, next: string) => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const TOKEN_KEY = "faceguard_token";

function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function setStoredToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

// Every request made through the generated API client (customFetch) will
// attach `Authorization: Bearer <token>` when this getter returns a token.
setAuthTokenGetter(getStoredToken);

export async function apiFetch(path: string, opts?: RequestInit) {
  const token = getStoredToken();
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...opts,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any).error ?? "Грешка");
  return data;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getStoredToken()) {
      setLoading(false);
      return;
    }
    apiFetch("/api/auth/me")
      .then((u) => setUser(u as AuthUser))
      .catch(() => {
        setStoredToken(null);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  async function login(username: string, password: string) {
    const u = await apiFetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    setStoredToken(u.token);
    setUser(u as AuthUser);
  }

  async function logout() {
    await apiFetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    setStoredToken(null);
    setUser(null);
  }

  async function changePassword(currentPassword: string, newPassword: string) {
    await apiFetch("/api/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  }

  return <Ctx.Provider value={{ user, loading, login, logout, changePassword }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
