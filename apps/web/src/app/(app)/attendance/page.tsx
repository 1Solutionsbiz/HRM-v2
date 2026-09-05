import { Clock } from "lucide-react";
import { PlaceholderPage } from "@/components/hrm/placeholder-page";

export default function Page() {
  return (
    <PlaceholderPage
      title="Attendance"
      description="Clock in/out, view your attendance history, and track late/half-day status."
      icon={Clock}
    />
  );
}
