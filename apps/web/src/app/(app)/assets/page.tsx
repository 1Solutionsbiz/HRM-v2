import { Laptop } from "lucide-react";
import { PlaceholderPage } from "@/components/hrm/placeholder-page";

export default function Page() {
  return (
    <PlaceholderPage
      title="My assets"
      description="See equipment and assets currently assigned to you."
      icon={Laptop}
    />
  );
}
