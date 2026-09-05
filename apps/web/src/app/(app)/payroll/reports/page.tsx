import { BarChart3 } from "lucide-react";
import { PlaceholderPage } from "@/components/hrm/placeholder-page";

export default function Page() {
  return (
    <PlaceholderPage
      title="Payroll reports"
      description="Generate and review payroll reports."
      icon={BarChart3}
    />
  );
}
