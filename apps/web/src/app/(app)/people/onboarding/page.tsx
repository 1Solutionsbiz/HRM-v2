import { UserPlus } from "lucide-react";
import { PlaceholderPage } from "@/components/hrm/placeholder-page";

export default function Page() {
  return (
    <PlaceholderPage
      title="Onboarding"
      description="Track new hire onboarding checklists."
      icon={UserPlus}
    />
  );
}
