import { LifeBuoy } from "lucide-react";
import { PlaceholderPage } from "@/components/hrm/placeholder-page";

export default function Page() {
  return (
    <PlaceholderPage
      title="Help & support"
      description="Raise and track IT/HR support tickets."
      icon={LifeBuoy}
    />
  );
}
