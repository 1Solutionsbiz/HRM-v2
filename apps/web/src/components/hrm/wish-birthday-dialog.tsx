"use client";

import * as React from "react";
import { toast } from "sonner";
import { useAuthenticatedUser } from "@/lib/auth-context";
import { ApiError } from "@/lib/api-client";
import { wishBirthday, employeeInitials } from "@/lib/api/employees";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export function WishBirthdayDialog({
  employeeId,
  name,
  onClose,
}: {
  employeeId: string;
  name: string;
  onClose: () => void;
}) {
  const sender = useAuthenticatedUser();
  const defaultMessage = `${sender.name}${sender.employeeCode ? ` (#${sender.employeeCode})` : ""} wishes you a very happy birthday! Enjoy your special day!`;
  const [message, setMessage] = React.useState(defaultMessage);
  const [sending, setSending] = React.useState(false);
  const parts = name.trim().split(/\s+/);
  const initials = employeeInitials({ firstName: parts[0] ?? "", lastName: parts[1] ?? "" });

  async function handleSend() {
    if (!message.trim()) return;
    setSending(true);
    try {
      await wishBirthday(employeeId, message.trim());
      toast.success(`Birthday wish sent to ${name}!`);
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't send this wish.");
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Wish happy birthday</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="birthday-message">Message</Label>
            <Textarea
              id="birthday-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label>Recipient</Label>
            <div className="flex items-center gap-2 rounded-full border px-2 py-1 w-fit">
              <Avatar className="size-6">
                <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
              </Avatar>
              <span className="text-sm">{name}</span>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={sending}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={sending || !message.trim()}>
            {sending ? "Sending…" : "Send"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
