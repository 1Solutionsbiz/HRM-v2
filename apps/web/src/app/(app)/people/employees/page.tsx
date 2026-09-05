import { Users } from "lucide-react";
import { PlaceholderPage } from "@/components/hrm/placeholder-page";

export default function Page() {
  return (
    <PlaceholderPage
      title="Employees"
      description="Manage the full employee directory and records."
      icon={Users}
    />
  );
}
