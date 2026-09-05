import { FolderOpen } from "lucide-react";
import { PlaceholderPage } from "@/components/hrm/placeholder-page";

export default function Page() {
  return (
    <PlaceholderPage
      title="Documents"
      description="Upload and manage your identity and employment documents."
      icon={FolderOpen}
    />
  );
}
