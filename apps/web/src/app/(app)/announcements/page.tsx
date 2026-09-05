import { Megaphone } from "lucide-react";
import { PlaceholderPage } from "@/components/hrm/placeholder-page";

export default function Page() {
  return (
    <PlaceholderPage
      title="Announcements"
      description="Company-wide announcements and updates."
      icon={Megaphone}
    />
  );
}
