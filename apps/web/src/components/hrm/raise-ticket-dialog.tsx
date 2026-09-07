"use client";

import * as React from "react";
import { toast } from "sonner";
import { ApiError } from "@/lib/api-client";
import {
  createTicket,
  TICKET_CATEGORY_LABEL,
  TICKET_PRIORITY_LABEL,
  type TicketCategory,
  type TicketPriority,
} from "@/lib/api/tickets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CATEGORY_OPTIONS = Object.entries(TICKET_CATEGORY_LABEL) as [TicketCategory, string][];
const PRIORITY_OPTIONS = Object.entries(TICKET_PRIORITY_LABEL) as [TicketPriority, string][];

interface RaiseTicketDialogProps {
  onCreated: () => void;
  trigger: React.ReactNode;
}

export function RaiseTicketDialog({ onCreated, trigger }: RaiseTicketDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [category, setCategory] = React.useState<TicketCategory | "">("");
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [priority, setPriority] = React.useState<TicketPriority>("MEDIUM");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function reset() {
    setCategory("");
    setTitle("");
    setDescription("");
    setPriority("MEDIUM");
    setError(null);
  }

  async function handleSubmit() {
    if (!category || !title.trim() || !description.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await createTicket({ category, title: title.trim(), description: description.trim(), priority });
      toast.success("Ticket raised");
      setOpen(false);
      reset();
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't raise this ticket. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Raise a ticket</DialogTitle>
          <DialogDescription>HR will pick this up and work it through to resolution.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as TicketCategory)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_OPTIONS.map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ticket-title">Title</Label>
            <Input
              id="ticket-title"
              placeholder="Short summary of the issue"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ticket-description">Description</Label>
            <Textarea
              id="ticket-description"
              placeholder="What happened, and any details HR should know"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={2000}
              rows={4}
            />
          </div>
          <div className="space-y-2">
            <Label>Priority</Label>
            <Select value={priority} onValueChange={(v) => setPriority(v as TicketPriority)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITY_OPTIONS.map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving || !category || !title.trim() || !description.trim()}>
            {saving ? "Raising…" : "Raise ticket"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
