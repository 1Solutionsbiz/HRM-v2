import { CalendarDays } from "lucide-react";
import { PlaceholderPage } from "@/components/hrm/placeholder-page";

export default function Page() {
  return (
    <PlaceholderPage
      title="Leave"
      description="Apply for leave and track your balance and approval status."
      icon={CalendarDays}
    />
  );
}
