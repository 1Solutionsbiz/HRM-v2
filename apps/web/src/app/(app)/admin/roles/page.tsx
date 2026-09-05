import { ShieldCheck } from "lucide-react";
import { PlaceholderPage } from "@/components/hrm/placeholder-page";

export default function Page() {
  return (
    <PlaceholderPage
      title="Roles & permissions"
      description="Manage roles and access permissions."
      icon={ShieldCheck}
    />
  );
}
