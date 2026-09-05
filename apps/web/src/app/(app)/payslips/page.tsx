import { Wallet } from "lucide-react";
import { PlaceholderPage } from "@/components/hrm/placeholder-page";

export default function Page() {
  return (
    <PlaceholderPage
      title="Payslips"
      description="View and download your monthly payslips."
      icon={Wallet}
    />
  );
}
