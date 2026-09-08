"use client";

import { useAsync } from "@/lib/use-async";
import { getPolls } from "@/lib/api/polls";
import { PollCard } from "@/components/hrm/poll-card";

/** Only open polls, directly votable from the dashboard - closed ones with
 * their results live on the full /polls page instead. */
export function PollsDashboardWidget() {
  const { data, refetch } = useAsync(getPolls);
  const open = (data ?? []).filter((p) => p.isOpen);

  if (open.length === 0) return null;

  return (
    <div className="space-y-4">
      {open.map((poll) => (
        <PollCard key={poll.id} poll={poll} onVoted={refetch} />
      ))}
    </div>
  );
}
