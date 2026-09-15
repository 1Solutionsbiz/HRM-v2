"use client";

import * as React from "react";
import { toast } from "sonner";
import { ApiError } from "@/lib/api-client";
import { recordAttendanceCorrection } from "@/lib/api/attendance";
import { formatDate } from "@/lib/format";
import { ConfirmDialog } from "@/components/hrm/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export interface AttendanceCorrectionTarget {
  employeeId: string;
  firstName: string;
  lastName: string;
  /** yyyy-mm-dd, the day being corrected. */
  date: string;
  firstCheckInAt: string | null;
  lastCheckOutAt: string | null;
}

interface AttendanceCorrectionDialogProps {
  target: AttendanceCorrectionTarget | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

/** ISO instant -> the local wall-clock value a `datetime-local` input expects, e.g. "2026-09-10T09:00". */
function toDateTimeLocalValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * One correction UI for any day's check-in/check-out, for any employee -
 * used from both the team roster (today) and an employee's history table
 * (any past day). Each field that's filled in and different from the
 * existing value gets recorded as a new superseding event (see
 * AttendanceService.recordCorrection); this can only ADD a correcting
 * event, never delete a punch outright - a spurious extra check-in/out
 * can be overridden but not removed.
 */
/**
 * Callers must remount this per target (e.g. `key={targetKey}`) rather
 * than rely on a prop-change effect to reset the form - see
 * https://react.dev/learn/you-might-not-need-an-effect#resetting-all-state-when-a-prop-changes.
 */
export function AttendanceCorrectionDialog({
  target,
  onOpenChange,
  onSaved,
}: AttendanceCorrectionDialogProps) {
  const initial = React.useMemo(
    () => ({
      checkIn: target?.firstCheckInAt ? toDateTimeLocalValue(target.firstCheckInAt) : "",
      checkOut: target?.lastCheckOutAt ? toDateTimeLocalValue(target.lastCheckOutAt) : "",
    }),
    // Only ever needs to run once per mount (see the remount-per-target
    // note above) - target itself is stable for the lifetime of a mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const [checkIn, setCheckIn] = React.useState(initial.checkIn);
  const [checkOut, setCheckOut] = React.useState(initial.checkOut);
  const [note, setNote] = React.useState("");

  async function handleSave() {
    if (!target) return;
    const trimmedNote = note.trim() || undefined;
    const original = target;
    try {
      const corrections: Promise<unknown>[] = [];
      // Only fields the admin actually changed get resubmitted - an
      // unchanged prefilled value shouldn't add a redundant event.
      if (checkIn && checkIn !== initial.checkIn) {
        corrections.push(
          recordAttendanceCorrection(original.employeeId, {
            type: "CHECK_IN",
            occurredAt: new Date(checkIn).toISOString(),
            note: trimmedNote,
          }),
        );
      }
      if (checkOut && checkOut !== initial.checkOut) {
        corrections.push(
          recordAttendanceCorrection(original.employeeId, {
            type: "CHECK_OUT",
            occurredAt: new Date(checkOut).toISOString(),
            note: trimmedNote,
          }),
        );
      }
      if (corrections.length === 0) return;
      // Sequential, not parallel - both write to the same AttendanceDay
      // and each triggers its own recompute; running them concurrently
      // risks one recompute overwriting fields the other just set.
      for (const correction of corrections) await correction;
      toast.success(`Attendance updated for ${original.firstName} ${original.lastName}`);
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't save the correction.");
    }
  }

  return (
    <ConfirmDialog
      open={!!target}
      onOpenChange={onOpenChange}
      title="Edit attendance"
      description={
        target
          ? `${target.firstName} ${target.lastName} — ${formatDate(target.date, { weekday: "short", day: "numeric", month: "short" })}`
          : ""
      }
      confirmLabel="Save"
      confirmDisabled={!checkIn && !checkOut}
      onConfirm={handleSave}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="correction-checkin">Check in</Label>
            <Input
              id="correction-checkin"
              type="datetime-local"
              value={checkIn}
              onChange={(e) => setCheckIn(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="correction-checkout">Check out</Label>
            <Input
              id="correction-checkout"
              type="datetime-local"
              value={checkOut}
              onChange={(e) => setCheckOut(e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="correction-note">Note (optional)</Label>
          <Textarea
            id="correction-note"
            rows={2}
            placeholder="e.g. mistaken punch, corrected per employee"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      </div>
    </ConfirmDialog>
  );
}
