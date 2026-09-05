import { Trophy } from "lucide-react";
import { PlaceholderPage } from "@/components/hrm/placeholder-page";

export default function Page() {
  return (
    <PlaceholderPage
      title="Employee of the month"
      description="Nominate and celebrate top performers."
      icon={Trophy}
    />
  );
}
