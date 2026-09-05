import { UserMinus } from "lucide-react";
import { PlaceholderPage } from "@/components/hrm/placeholder-page";

export default function Page() {
  return (
    <PlaceholderPage
      title="Resignations"
      description="Manage resignation requests and notice periods."
      icon={UserMinus}
    />
  );
}
