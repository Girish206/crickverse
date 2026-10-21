import { createContext, useContext, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiClient, getAdminToken, setAdminToken } from "../api/client";
import type { ApiEnvelope } from "../api/types";

// CrickVerse signs in with the shared Girish Creations account (same API,
// same /admin/auth/login), but only accounts with cricket access get in.
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
  logout: () => void;
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

  async function login(identifier: string, password: string) {
    const { data } = await apiClient.post<ApiEnvelope<{ token: string }>>("/admin/auth/login", {
      email: identifier.trim(),
      password,
    });
    // Same source as a page reload: the response's `admin` carries `id`, not
    // the `sub` the rest of the app reads.
    const identity = decodeAdminFromToken(data.data.token);
    if (!identity?.hasCricketAccess) {
      throw new NoCricketAccessError();
    }
    setAdminToken(data.data.token);
    queryClient.clear();
    setAdmin(identity);
  }

  function logout() {
    setAdminToken(null);
    queryClient.clear();
    setAdmin(null);
  }

  return (
    <AdminAuthContext.Provider value={{ isAuthenticated: admin !== null, admin, login, logout, mainBg, setMainBg }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

// A valid Girish Creations account that hasn't been given CrickVerse access.
export class NoCricketAccessError extends Error {
  constructor() {
    super("This account doesn't have CrickVerse access yet. Ask your organiser to turn it on.");
  }
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) {
    throw new Error("useAdminAuth must be used within AdminAuthProvider");
  }
  return ctx;
}
