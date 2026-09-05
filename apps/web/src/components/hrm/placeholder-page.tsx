import type { LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/hrm/page-header";
import { EmptyState } from "@/components/hrm/empty-state";

interface PlaceholderPageProps {
  title: string;
  description: string;
  icon: LucideIcon;
}

/**
 * Every nav destination that doesn't have real functionality yet renders
 * this, so the navigation system and layout can be verified end-to-end
 * without pretending any business logic exists.
 */
export function PlaceholderPage({
  title,
  description,
  icon,
}: PlaceholderPageProps) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description} />
      <EmptyState
        icon={icon}
        title="This module hasn't been built yet"
        description="The navigation and layout are ready - the backend and business logic come next."
      />
    </div>
  );
}
