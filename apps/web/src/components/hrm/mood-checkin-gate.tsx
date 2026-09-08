"use client";

import * as React from "react";
import { toast } from "sonner";
import { cn } from "cn";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api-client";
import {
  getMoodCheckInStatus,
  submitMoodCheckIn,
  dismissMoodCheckIn,
  MOOD_OPTIONS,
  MOOD_TAGS,
  type MoodLevel,
} from "@/lib/api/mood-checkins";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Toggle } from "@/components/ui/toggle";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

/**
 * Mounted once in the authenticated app shell so it shows regardless of
 * which page a login lands on. Checks status on mount, not tied to a
 * specific route - `getStatus`/`dismiss` are both keyed off the server's
 * own "today" (see MoodCheckInsService), so this naturally shows once per
 * calendar day and never again once handled, across logins/tabs.
 */
export function MoodCheckInGate() {
  const { user } = useAuth();
  const [open, setOpen] = React.useState(false);
  const [mood, setMood] = React.useState<MoodLevel | null>(null);
  const [tags, setTags] = React.useState<string[]>([]);
  const [comment, setComment] = React.useState("");
  const [anonymous, setAnonymous] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!user) return;
    getMoodCheckInStatus()
      .then((status) => {
        if (!status.handledToday) setOpen(true);
      })
      .catch(() => {
        // Not being able to check shouldn't block the app - just skip the popup.
      });
  }, [user]);

  function toggleTag(tag: string) {
    setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }

  async function handleClose() {
    setOpen(false);
    try {
      await dismissMoodCheckIn();
    } catch {
      // Best-effort - if this fails, the popup may just reappear next login.
    }
  }

  async function handleSubmit() {
    if (!mood) return;
    setSubmitting(true);
    try {
      await submitMoodCheckIn({ mood, tags, comment: comment.trim() || undefined, isAnonymous: anonymous });
      toast.success("Thanks for sharing how you're feeling!");
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't submit your feedback.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && handleClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <div className="space-y-6 pt-2">
          <h2 className="text-center text-xl font-semibold">
            Hi {user.name}, how is your mood today?
          </h2>

          <div className="flex flex-wrap justify-center gap-3 sm:gap-6">
            {MOOD_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setMood(opt.value)}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-lg p-2 transition-colors",
                  mood === opt.value ? "bg-primary/10" : "hover:bg-accent",
                )}
              >
                <span className="text-4xl">{opt.emoji}</span>
                <span className="text-xs font-medium">{opt.label}</span>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap justify-center gap-2">
            {MOOD_TAGS.map((tag) => (
              <Toggle
                key={tag}
                variant="outline"
                size="sm"
                pressed={tags.includes(tag)}
                onPressedChange={() => toggleTag(tag)}
                className="rounded-full"
              >
                {tag}
              </Toggle>
            ))}
          </div>

          <div className="space-y-2">
            <Label htmlFor="mood-comment">Comments</Label>
            <Textarea id="mood-comment" value={comment} onChange={(e) => setComment(e.target.value)} rows={2} />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Checkbox
                id="mood-anonymous"
                checked={anonymous}
                onCheckedChange={(v) => setAnonymous(v === true)}
              />
              <Label htmlFor="mood-anonymous" className="text-sm font-normal">
                Share anonymous feedback
              </Label>
            </div>
            <Button onClick={handleSubmit} disabled={!mood || submitting}>
              {submitting ? "Submitting…" : "Submit"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
