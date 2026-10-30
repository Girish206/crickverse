import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiClient, getAdminToken, setAdminToken } from "../api/client";
import type { ApiEnvelope } from "../api/types";

// RunMitra signs in with the shared Girish Creations account (same API,
// same /admin/auth/login), but only accounts with cricket access get in.
// Players can also sign themselves up. Sessions are "remembered" (long-lived
// tokens, renewed each time the app opens), so nobody signs in every visit.
interface AdminIdentity {
  sub: string;
  // Null for an account that signs in with its mobile number.
  email: string | null;
  name: string | null;
  isOwner: boolean;
  // Organiser: manages players, tournaments and scoring.
  isSuperAdmin: boolean;
  // Player access (super admins always have it).
  hasCricketAccess: boolean;
}

interface AdminAuthContextValue {
  isAuthenticated: boolean;
  admin: AdminIdentity | null;
  // `identifier` is a mobile number or an email address.
  login: (identifier: string, password: string) => Promise<void>;
  register: (input: { name?: string; mobile: string; password: string; inviteCode?: string }) => Promise<void>;
  // Signs in with a token the API just issued (e.g. after a profile edit,
  // which changes the name and mobile it carries).
  applyToken: (token: string) => void;
  // `everywhere` also ends the account's sessions on every other device.
  logout: (options?: { everywhere?: boolean }) => Promise<void>;
  // A user-selectable background tint for the shell (Layout reads it).
  mainBg: string;
  setMainBg: (bg: string) => void;
}

const AdminAuthContext = createContext<AdminAuthContextValue | undefined>(undefined);

function decodeAdminFromToken(token: string): AdminIdentity | null {
  try {
    // JWT segments are base64url ("-"/"_", no padding); atob() only accepts
    // standard base64 and throws on those characters.
    const segment = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(segment.padEnd(Math.ceil(segment.length / 4) * 4, "=")));
    if (typeof payload.exp === "number" && payload.exp * 1000 < Date.now()) return null;
    const isSuperAdmin = Boolean(payload.isSuperAdmin || payload.isOwner);
    return {
      sub: payload.sub,
      email: payload.email ?? null,
      name: payload.name ?? null,
      isOwner: Boolean(payload.isOwner),
      isSuperAdmin,
      hasCricketAccess: Boolean(payload.hasCricketAccess || isSuperAdmin),
    };
  } catch {
    return null;
  }
}

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [admin, setAdmin] = useState<AdminIdentity | null>(() => {
    const token = getAdminToken();
    const identity = token ? decodeAdminFromToken(token) : null;
    if (token && !identity?.hasCricketAccess) setAdminToken(null);
    return identity?.hasCricketAccess ? identity : null;
  });
  const [mainBg, setMainBgState] = useState(() => localStorage.getItem("crickverse_mainBg") || "bg-light");

  function setMainBg(bg: string) {
    localStorage.setItem("crickverse_mainBg", bg);
    setMainBgState(bg);
  }

  // Once per app open: swap the stored token for a fresh one, so the
  // session slides forward and picks up any change to the account (a new
  // name, organiser access). A token the API rejects signs out (client.ts).
  useEffect(() => {
    if (!getAdminToken()) return;
    apiClient
      .post<ApiEnvelope<{ token: string }>>("/admin/auth/refresh", { remember: true })
      .then(({ data }) => {
        const identity = decodeAdminFromToken(data.data.token);
        if (!identity?.hasCricketAccess) return;
        setAdminToken(data.data.token);
        setAdmin(identity);
      })
      .catch(() => undefined);
  }, []);

  // Same source as a page reload: the response's `admin` carries `id`, not
  // the `sub` the rest of the app reads.
  function signInWith(token: string, clearCache: boolean) {
    const identity = decodeAdminFromToken(token);
    if (!identity?.hasCricketAccess) {
      throw new NoCricketAccessError();
    }
    setAdminToken(token);
    if (clearCache) queryClient.clear();
    setAdmin(identity);
  }

  async function login(identifier: string, password: string) {
    const { data } = await apiClient.post<ApiEnvelope<{ token: string }>>("/admin/auth/login", {
      email: identifier.trim(),
      password,
      remember: true,
    });
    signInWith(data.data.token, true);
  }

  async function register(input: { name?: string; mobile: string; password: string; inviteCode?: string }) {
    const { data } = await apiClient.post<ApiEnvelope<{ token: string }>>("/admin/cricket/register", input);
    signInWith(data.data.token, true);
  }

  function applyToken(token: string) {
    signInWith(token, false);
  }

  async function logout({ everywhere = false } = {}) {
    if (everywhere) await apiClient.post("/admin/auth/logout", { everywhere: true });
    setAdminToken(null);
    queryClient.clear();
    setAdmin(null);
  }

  return (
    <AdminAuthContext.Provider
      value={{ isAuthenticated: admin !== null, admin, login, register, applyToken, logout, mainBg, setMainBg }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
}

// A valid Girish Creations account that hasn't been given RunMitra access.
export class NoCricketAccessError extends Error {
  constructor() {
    super("This account doesn't have RunMitra access yet. Ask your organiser to turn it on.");
  }
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) {
    throw new Error("useAdminAuth must be used within AdminAuthProvider");
  }
  return ctx;
}
