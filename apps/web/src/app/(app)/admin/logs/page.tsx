import { ScrollText } from "lucide-react";
import { PlaceholderPage } from "@/components/hrm/placeholder-page";

export default function Page() {
  return (
    <PlaceholderPage
      title="System logs"
      description="Review login activity and audit logs."
      icon={ScrollText}
    />
  );
}
