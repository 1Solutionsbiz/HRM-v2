export const ROLES = ["employee", "manager", "hr", "admin"] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  employee: "Employee",
  manager: "Manager",
  hr: "HR",
  admin: "Admin",
};
