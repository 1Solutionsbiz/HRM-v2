"use client";

import * as React from "react";
import { toast } from "sonner";
import { Trash2, Vote } from "lucide-react";
import { ApiError } from "@/lib/api-client";
import { votePoll, deletePoll, type Poll } from "@/lib/api/polls";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ConfirmDialog } from "@/components/hrm/confirm-dialog";

export function PollCard({
  poll,
  onVoted,
  onDeleted,
  canManage = false,
  className,
}: {
  poll: Poll;
  onVoted: () => void;
  onDeleted?: () => void;
  canManage?: boolean;
  className?: string;
}) {
  const [selected, setSelected] = React.useState(poll.myOptionId ?? "");
  const [submitting, setSubmitting] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  async function handleVote() {
    if (!selected) return;
    setSubmitting(true);
    try {
      await votePoll(poll.id, selected);
      toast.success("Vote recorded");
      onVoted();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't record your vote.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await deletePoll(poll.id);
      toast.success("Poll deleted");
      onDeleted?.();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't delete this poll.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="text-sm font-semibold">{poll.question}</CardTitle>
          <p className="text-muted-foreground mt-1 text-xs">
            {poll.isOpen
              ? `Voting closes ${formatDate(poll.endsAt, { day: "numeric", month: "short" })}`
              : `Closed ${formatDate(poll.endsAt, { day: "numeric", month: "short" })}`}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Vote className="text-muted-foreground size-4" />
          {canManage && (
            <Button
              size="icon"
              variant="ghost"
              className={cn("text-muted-foreground hover:text-destructive size-7")}
              onClick={() => setConfirmOpen(true)}
              disabled={deleting}
              aria-label="Delete poll"
            >
              <Trash2 className="size-3.5" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {poll.isOpen ? (
          poll.hasVoted ? (
            <div className="space-y-2">
              {poll.options.map((o) => (
                <div key={o.id} className="flex items-center gap-2 text-sm">
                  <span
                    className={cn(
                      "flex size-4 shrink-0 items-center justify-center rounded-full border",
                      o.id === poll.myOptionId ? "border-primary bg-primary" : "border-input",
                    )}
                  >
                    {o.id === poll.myOptionId && <span className="bg-primary-foreground size-1.5 rounded-full" />}
                  </span>
                  <span className={o.id === poll.myOptionId ? "font-medium" : "text-muted-foreground"}>
                    {o.label}
                  </span>
                </div>
              ))}
              <p className="text-muted-foreground text-xs">
                You&apos;ve voted - your choice is locked in, and results show once the poll closes.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <RadioGroup value={selected} onValueChange={setSelected}>
                {poll.options.map((o) => (
                  <label key={o.id} className="flex items-center gap-2 text-sm">
                    <RadioGroupItem value={o.id} />
                    {o.label}
                  </label>
                ))}
              </RadioGroup>
              <Button size="sm" onClick={handleVote} disabled={!selected || submitting}>
                {submitting ? "Saving…" : "Vote"}
              </Button>
            </div>
          )
        ) : (
          <div className="space-y-2">
            {poll.results?.options.map((o) => (
              <div key={o.id} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className={o.id === poll.myOptionId ? "font-semibold" : undefined}>
                    {o.label}
                    {o.id === poll.myOptionId && " (your vote)"}
                  </span>
                  <span className="text-muted-foreground">
                    {o.count} · {o.percentage}%
                  </span>
                </div>
                <div className="bg-background/60 h-1.5 overflow-hidden rounded-full">
                  <div className="bg-primary h-full rounded-full" style={{ width: `${o.percentage}%` }} />
                </div>
              </div>
            ))}
            <p className="text-muted-foreground text-xs">{poll.results?.totalVotes ?? 0} total votes</p>
          </div>
        )}
      </CardContent>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete this poll?"
        description={`"${poll.question}" and all its votes will be permanently removed. This can't be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </Card>
  );
}
