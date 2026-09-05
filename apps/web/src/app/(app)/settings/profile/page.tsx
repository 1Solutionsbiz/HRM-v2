import { UserCircle } from "lucide-react";
import { PlaceholderPage } from "@/components/hrm/placeholder-page";

export default function Page() {
  return (
    <PlaceholderPage
      title="Profile & settings"
      description="Manage your personal profile and preferences."
      icon={UserCircle}
    />
  );
}
