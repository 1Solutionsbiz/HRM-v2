"use client";

import * as React from "react";
import { Vote, Plus } from "lucide-react";
import { useAsync } from "@/lib/use-async";
import { useAuthenticatedUser } from "@/lib/auth-context";
import { getPolls } from "@/lib/api/polls";
import { PageHeader } from "@/components/hrm/page-header";
import { AsyncSection } from "@/components/hrm/async-section";
import { EmptyState } from "@/components/hrm/empty-state";
import { CardSkeleton } from "@/components/hrm/loading-state";
import { PollCard } from "@/components/hrm/poll-card";
import { CreatePollDialog } from "@/components/hrm/create-poll-dialog";
import { Button } from "@/components/ui/button";

export default function PollsPage() {
  const user = useAuthenticatedUser();
  const canManage = user.role === "admin" || user.role === "hr";
  const { data, loading, error, refetch } = useAsync(getPolls);
  const [createOpen, setCreateOpen] = React.useState(false);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Polls"
        description="Vote on open polls; results appear once a poll closes."
        actions={
          canManage ? (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus />
              Create poll
            </Button>
          ) : undefined
        }
      />

      <AsyncSection
        loading={loading}
        error={error}
        onRetry={refetch}
        loadingFallback={
          <div className="space-y-3">
            <CardSkeleton lines={3} />
            <CardSkeleton lines={3} />
          </div>
        }
      >
        {(data ?? []).length === 0 ? (
          <EmptyState icon={Vote} title="No polls yet" />
        ) : (
          <div className="space-y-4">
            {(data ?? []).map((poll) => (
              <PollCard key={poll.id} poll={poll} onVoted={refetch} />
            ))}
          </div>
        )}
      </AsyncSection>

      {createOpen && (
        <CreatePollDialog onClose={() => setCreateOpen(false)} onCreated={refetch} />
      )}
    </div>
  );
}
