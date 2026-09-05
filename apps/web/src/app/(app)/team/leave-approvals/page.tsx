import { ClipboardList } from "lucide-react";
import { PlaceholderPage } from "@/components/hrm/placeholder-page";

export default function Page() {
  return (
    <PlaceholderPage
      title="Leave approvals"
      description="Approve or decline your team's leave requests."
      icon={ClipboardList}
    />
  );
}
