import { BadgeIndianRupee } from "lucide-react";
import { PlaceholderPage } from "@/components/hrm/placeholder-page";

export default function Page() {
  return (
    <PlaceholderPage
      title="Salary management"
      description="Manage employee compensation and salary structures."
      icon={BadgeIndianRupee}
    />
  );
}
