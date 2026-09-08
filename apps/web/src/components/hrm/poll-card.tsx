"use client";

import * as React from "react";
import { toast } from "sonner";
import { Vote } from "lucide-react";
import { ApiError } from "@/lib/api-client";
import { votePoll, type Poll } from "@/lib/api/polls";
import { formatDate } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export function PollCard({ poll, onVoted }: { poll: Poll; onVoted: () => void }) {
  const [selected, setSelected] = React.useState(poll.myOptionId ?? "");
  const [submitting, setSubmitting] = React.useState(false);

  async function handleVote() {
    if (!selected) return;
    setSubmitting(true);
    try {
      await votePoll(poll.id, selected);
      toast.success(poll.hasVoted ? "Vote updated" : "Vote recorded");
      onVoted();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't record your vote.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="text-sm font-semibold">{poll.question}</CardTitle>
          <p className="text-muted-foreground mt-1 text-xs">
            {poll.isOpen
              ? `Voting closes ${formatDate(poll.endsAt, { day: "numeric", month: "short" })}`
              : `Closed ${formatDate(poll.endsAt, { day: "numeric", month: "short" })}`}
          </p>
        </div>
        <Vote className="text-muted-foreground size-4 shrink-0" />
      </CardHeader>
      <CardContent>
        {poll.isOpen ? (
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
              {submitting ? "Saving…" : poll.hasVoted ? "Update vote" : "Vote"}
            </Button>
            {poll.hasVoted && (
              <p className="text-muted-foreground text-xs">
                You&apos;ve voted - results show once the poll closes.
              </p>
            )}
          </div>
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
                <div className="bg-muted h-1.5 overflow-hidden rounded-full">
                  <div className="bg-primary h-full rounded-full" style={{ width: `${o.percentage}%` }} />
                </div>
              </div>
            ))}
            <p className="text-muted-foreground text-xs">{poll.results?.totalVotes ?? 0} total votes</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
