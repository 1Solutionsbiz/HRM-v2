"use client";

import { useRole } from "@/lib/role-context";
import { ManagerDashboard } from "./manager-dashboard";
import { HRDashboard } from "./hr-dashboard";
import { AdminDashboard } from "./admin-dashboard";

/**
 * Manager, HR, and Admin get deliberately different dashboards, not one
 * layout with role-conditionals sprinkled through it - HR/Admin need to see
 * a lot at once (company-wide counts, multiple approval queues), where a
 * manager's view stays close to their own team.
 */
export default function DashboardPage() {
  const { role, user } = useRole();
  const firstName = user.name.split(" ")[0];

  if (role === "hr") return <HRDashboard firstName={firstName} />;
  if (role === "admin") return <AdminDashboard firstName={firstName} />;
  return <ManagerDashboard firstName={firstName} />;
}
