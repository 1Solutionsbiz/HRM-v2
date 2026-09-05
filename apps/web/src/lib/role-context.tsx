"use client";

import * as React from "react";
import { ROLES, type Role } from "@/types/role";

const STORAGE_KEY = "hrm-v2:preview-role";

interface MockUser {
  name: string;
  email: string;
  initials: string;
  designation: string;
}

const MOCK_USERS: Record<Role, MockUser> = {
  employee: {
    name: "Aditi Sharma",
    email: "aditi.sharma@1solutions.biz",
    initials: "AS",
    designation: "Software Engineer",
  },
  manager: {
    name: "Rahul Verma",
    email: "rahul.verma@1solutions.biz",
    initials: "RV",
    designation: "Engineering Manager",
  },
  hr: {
    name: "Priya Nair",
    email: "priya.nair@1solutions.biz",
    initials: "PN",
    designation: "HR Business Partner",
  },
  admin: {
    name: "Karan Mehta",
    email: "karan.mehta@1solutions.biz",
    initials: "KM",
    designation: "System Administrator",
  },
};

interface RoleContextValue {
  role: Role;
  setRole: (role: Role) => void;
  user: MockUser;
}

const RoleContext = React.createContext<RoleContextValue | null>(null);

function isRole(value: string | null): value is Role {
  return !!value && (ROLES as readonly string[]).includes(value);
}

/**
 * Stands in for real authentication/authorization until the backend exists.
 * Holds which of the four experiences (employee/manager/hr/admin) is being
 * previewed, persisted to localStorage only - never a real session.
 */
export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = React.useState<Role>("employee");

  React.useEffect(() => {
    // One-time sync from localStorage on mount, deliberately not derived via
    // a lazy useState initializer: reading it during render would return a
    // different value on the client than the server rendered, causing a
    // hydration mismatch since the role affects which nav items render.
    const stored = window.localStorage.getItem(STORAGE_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing from an external store (localStorage) on mount, not a derived-state anti-pattern
    if (isRole(stored)) setRoleState(stored);
  }, []);

  const setRole = React.useCallback((next: Role) => {
    setRoleState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // localStorage unavailable (private browsing, etc.) - preview role
      // just won't persist across reloads.
    }
  }, []);

  const value = React.useMemo(
    () => ({ role, setRole, user: MOCK_USERS[role] }),
    [role, setRole],
  );

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole() {
  const ctx = React.useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be used within a RoleProvider");
  return ctx;
}
