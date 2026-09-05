import { Clock } from "lucide-react";
import { PlaceholderPage } from "@/components/hrm/placeholder-page";

export default function Page() {
  return (
    <PlaceholderPage
      title="Team attendance"
      description="Review your team's daily attendance."
      icon={Clock}
    />
  );
}
