import { Users } from "lucide-react";
import { PlaceholderPage } from "@/components/hrm/placeholder-page";

export default function Page() {
  return (
    <PlaceholderPage
      title="Team directory"
      description="Browse your team's profiles and reporting lines."
      icon={Users}
    />
  );
}
