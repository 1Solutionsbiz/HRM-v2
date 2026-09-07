"use client";

import * as React from "react";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { ApiError } from "@/lib/api-client";
import { formatDate, formatRelativeTime } from "@/lib/format";
import { employeeFullName } from "@/lib/api/employees";
import {
  addTicketComment,
  updateTicketStatus,
  TICKET_CATEGORY_LABEL,
  TICKET_PRIORITY_LABEL,
  TICKET_STATUS_LABEL,
  TICKET_STATUS_TONE,
  type Ticket,
  type TicketStatus,
} from "@/lib/api/tickets";
import { StatusBadge } from "@/components/hrm/status-badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

const STATUS_OPTIONS = Object.entries(TICKET_STATUS_LABEL) as [TicketStatus, string][];

interface TicketDetailSheetProps {
  ticket: Ticket;
  currentUserEmail: string;
  canManage: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: (ticket: Ticket) => void;
}

export function TicketDetailSheet({
  ticket,
  currentUserEmail,
  canManage,
  onOpenChange,
  onUpdated,
}: TicketDetailSheetProps) {
  const [comment, setComment] = React.useState("");
  const [posting, setPosting] = React.useState(false);
  const [changingStatus, setChangingStatus] = React.useState(false);

  async function handlePostComment() {
    if (!comment.trim()) return;
    setPosting(true);
    try {
      const updated = await addTicketComment(ticket.id, comment.trim());
      setComment("");
      onUpdated(updated);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't post this comment.");
    } finally {
      setPosting(false);
    }
  }

  async function handleStatusChange(status: TicketStatus) {
    setChangingStatus(true);
    try {
      const updated = await updateTicketStatus(ticket.id, status);
      toast.success(`Status changed to ${TICKET_STATUS_LABEL[status]}`);
      onUpdated(updated);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't update the ticket status.");
    } finally {
      setChangingStatus(false);
    }
  }

  return (
    <Sheet open onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col sm:max-w-lg">
        <SheetHeader>
          <div className="flex items-center gap-2">
            <SheetTitle className="truncate">{ticket.title}</SheetTitle>
            <StatusBadge
              status={TICKET_STATUS_LABEL[ticket.status]}
              tone={TICKET_STATUS_TONE[ticket.status]}
            />
          </div>
          <SheetDescription>
            {ticket.code} · {employeeFullName(ticket.employee)} · {TICKET_CATEGORY_LABEL[ticket.category]}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-4 overflow-y-auto px-4">
          <div className="space-y-1">
            <p className="text-muted-foreground text-xs font-medium">Description</p>
            <p className="text-sm whitespace-pre-wrap">{ticket.description}</p>
          </div>

          <div className="flex gap-6 text-sm">
            <div>
              <p className="text-muted-foreground text-xs font-medium">Priority</p>
              <p>{TICKET_PRIORITY_LABEL[ticket.priority]}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs font-medium">Raised</p>
              <p>{formatDate(ticket.createdAt)}</p>
            </div>
          </div>

          {canManage && (
            <div className="space-y-2">
              <p className="text-muted-foreground text-xs font-medium">Status</p>
              <Select
                value={ticket.status}
                onValueChange={(v) => handleStatusChange(v as TicketStatus)}
                disabled={changingStatus}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-3 border-t pt-4">
            <p className="text-muted-foreground text-xs font-medium">
              Comments {ticket.comments.length > 0 && `(${ticket.comments.length})`}
            </p>
            {ticket.comments.length === 0 ? (
              <p className="text-muted-foreground text-sm">No comments yet.</p>
            ) : (
              <ul className="space-y-3">
                {ticket.comments.map((c) => {
                  const isMe = c.authorUser.email === currentUserEmail;
                  return (
                    <li key={c.id} className="flex gap-2.5">
                      <Avatar className="size-7 shrink-0">
                        <AvatarFallback className="text-xs">
                          {c.authorUser.email.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-sm font-medium">{isMe ? "You" : c.authorUser.email}</span>
                          <span className="text-muted-foreground text-xs">{formatRelativeTime(c.createdAt)}</span>
                        </div>
                        <p className="text-sm whitespace-pre-wrap">{c.body}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <div className="flex items-end gap-2 border-t p-4">
          <Textarea
            placeholder="Add a comment…"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={2000}
            rows={2}
            className="flex-1"
          />
          <Button size="icon" onClick={handlePostComment} disabled={posting || !comment.trim()}>
            <Send />
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
