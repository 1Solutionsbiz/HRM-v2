"use client";

import { useAsync } from "@/lib/use-async";
import { useAuthenticatedUser } from "@/lib/auth-context";
import { getPolls } from "@/lib/api/polls";
import { PollCard } from "@/components/hrm/poll-card";

/**
 * Only ever one poll on the dashboard, not a stack of every open one - the
 * soonest-closing (most urgent to vote on) wins if several happen to be
 * open at once. Full history (open + closed) lives on /polls instead.
 */
export function PollsDashboardWidget({ className }: { className?: string }) {
  const user = useAuthenticatedUser();
  const canManage = user.role === "admin" || user.role === "hr";
  const { data, refetch } = useAsync(getPolls);
  const open = (data ?? [])
    .filter((p) => p.isOpen)
    .sort((a, b) => new Date(a.endsAt).getTime() - new Date(b.endsAt).getTime());
  const poll = open[0];

  if (!poll) return null;

  return (
    <PollCard
      poll={poll}
      onVoted={refetch}
      onDeleted={refetch}
      canManage={canManage}
      className={className}
    />
  );
}
