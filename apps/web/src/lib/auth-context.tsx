"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { apiFetch, ApiError, tokenStorage } from "@/lib/api-client";
import { ROLES, type Role } from "@/types/role";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  initials: string;
  designation: string | null;
  lastLoginAt: string | null;
  role: Role;
}

interface MeResponse {
  id: string;
  email: string;
  lastLoginAt: string | null;
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
    employeeCode: string;
    designation: { title: string } | null;
  } | null;
  roles: { key: string; label: string }[];
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

function toAuthUser(me: MeResponse): AuthUser {
  // The frontend still assumes one role per user (matching the admin
  // "Roles & permissions" screen's single-select dropdown, module 17) — the
  // backend can grant more than one, so this takes the first role key it
  // recognizes. No recognized role at all means there's no experience to
  // show; that's treated as a login failure, not a silent default.
  const roleKey = me.roles.map((r) => r.key).find(isRole);
  if (!roleKey) {
    throw new Error(
      "This account has no recognized role assigned. Contact an administrator.",
    );
  }

  const name = me.employee ? `${me.employee.firstName} ${me.employee.lastName}` : me.email;
  const initials = me.employee
    ? `${me.employee.firstName.charAt(0)}${me.employee.lastName.charAt(0)}`.toUpperCase()
    : me.email.slice(0, 2).toUpperCase();

  return {
    id: me.id,
    email: me.email,
    name,
    initials,
    designation: me.employee?.designation?.title ?? null,
    lastLoginAt: me.lastLoginAt,
    role: roleKey,
  };
}

interface AuthContextValue {
  user: AuthUser | null;
  /** True only while the initial /auth/me hydration check (from a stored token) is in flight — a hard refresh must show a loading state here, not bounce an authenticated user to /login before it resolves. */
  isLoading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const router = useRouter();

  const clearSession = React.useCallback(() => {
    tokenStorage.clearTokens();
    setUser(null);
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    async function hydrate() {
      if (!tokenStorage.getStoredTokens()) {
        if (!cancelled) setIsLoading(false);
        return;
      }
      try {
        const me = await apiFetch<MeResponse>("/auth/me");
        if (!cancelled) setUser(toAuthUser(me));
      } catch {
        tokenStorage.clearTokens();
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void hydrate();
    return () => {
      cancelled = true;
    };
  }, []);

  // api-client.ts isn't a React context consumer, so a session that dies
  // mid-request (refresh also failed) is signaled via this window event
  // rather than a direct call in here.
  React.useEffect(() => {
    function handleSessionExpired() {
      clearSession();
      router.push("/login");
    }
    window.addEventListener("hrm:session-expired", handleSessionExpired);
    return () => window.removeEventListener("hrm:session-expired", handleSessionExpired);
  }, [clearSession, router]);

  const login = React.useCallback(async (email: string, password: string) => {
    const tokens = await apiFetch<TokenPair>("/auth/login", {
      method: "POST",
      body: { email, password },
      skipAuth: true,
    });
    tokenStorage.storeTokens(tokens);
    try {
      const me = await apiFetch<MeResponse>("/auth/me");
      const authUser = toAuthUser(me);
      setUser(authUser);
      return authUser;
    } catch (error) {
      // Tokens were issued but the account can't actually be used here
      // (e.g. no recognized role) — don't leave a half-logged-in session.
      tokenStorage.clearTokens();
      throw error;
    }
  }, []);

  const logout = React.useCallback(async () => {
    try {
      await apiFetch("/auth/logout", { method: "POST" });
    } catch {
      // Best-effort — the local session clears regardless of whether the
      // backend call succeeded (network down, token already expired, etc).
    }
    clearSession();
    router.push("/login");
  }, [clearSession, router]);

  const value = React.useMemo(
    () => ({ user, isLoading, login, logout }),
    [user, isLoading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}

/**
 * For components that only ever render inside AppShell's protected route
 * tree, where the shell's own guard (isLoading/user checks) has already
 * guaranteed a signed-in user before mounting them — throws instead of
 * returning a possibly-null user, so a genuine wiring mistake fails loudly
 * rather than rendering `undefined` into a name field.
 */
export function useAuthenticatedUser(): AuthUser {
  const { user } = useAuth();
  if (!user) {
    throw new Error(
      "useAuthenticatedUser() called before authentication resolved — only use inside AppShell's protected route tree",
    );
  }
  return user;
}

export { ApiError };
