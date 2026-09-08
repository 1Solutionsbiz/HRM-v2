"use client";

import * as React from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { ApiError } from "@/lib/api-client";
import { createPoll } from "@/lib/api/polls";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

function defaultEndsAt() {
  const d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  d.setSeconds(0, 0);
  // datetime-local expects "YYYY-MM-DDTHH:mm" in local time.
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function CreatePollDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [question, setQuestion] = React.useState("");
  const [options, setOptions] = React.useState(["", ""]);
  const [endsAt, setEndsAt] = React.useState(defaultEndsAt());
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function updateOption(i: number, value: string) {
    setOptions((prev) => prev.map((o, idx) => (idx === i ? value : o)));
  }

  function addOption() {
    if (options.length < 8) setOptions((prev) => [...prev, ""]);
  }

  function removeOption(i: number) {
    if (options.length > 2) setOptions((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleSubmit() {
    setError(null);
    const trimmedOptions = options.map((o) => o.trim()).filter(Boolean);
    if (!question.trim()) {
      setError("Enter a question.");
      return;
    }
    if (trimmedOptions.length < 2) {
      setError("Enter at least 2 options.");
      return;
    }
    if (new Set(trimmedOptions).size !== trimmedOptions.length) {
      setError("Options must be unique.");
      return;
    }
    const endsAtDate = new Date(endsAt);
    if (Number.isNaN(endsAtDate.getTime()) || endsAtDate <= new Date()) {
      setError("Pick a closing date/time in the future.");
      return;
    }

    setSaving(true);
    try {
      await createPoll({
        question: question.trim(),
        endsAt: endsAtDate.toISOString(),
        options: trimmedOptions,
      });
      toast.success("Poll created");
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't create this poll.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create poll</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor="poll-question">Question</Label>
            <Input
              id="poll-question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g. Which day should we hold the team outing?"
            />
          </div>
          <div className="space-y-2">
            <Label>Options</Label>
            <div className="space-y-2">
              {options.map((o, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={o}
                    onChange={(e) => updateOption(i, e.target.value)}
                    placeholder={`Option ${i + 1}`}
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => removeOption(i)}
                    disabled={options.length <= 2}
                    aria-label="Remove option"
                  >
                    <Trash2 />
                  </Button>
                </div>
              ))}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addOption} disabled={options.length >= 8}>
              <Plus />
              Add option
            </Button>
          </div>
          <div className="space-y-2">
            <Label htmlFor="poll-ends-at">Closes on</Label>
            <Input
              id="poll-ends-at"
              type="datetime-local"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
            />
            <p className="text-muted-foreground text-xs">
              Results stay hidden from everyone until this time passes.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "Creating…" : "Create poll"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
