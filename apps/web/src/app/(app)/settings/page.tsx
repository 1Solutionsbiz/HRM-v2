"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { KeyRound, Monitor, Moon, Sun } from "lucide-react";
import { ApiError } from "@/lib/api-client";
import { changePassword } from "@/lib/api/auth";
import { PageHeader } from "@/components/hrm/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";

const NOTIF_PREFS = [
  { id: "leave", label: "Leave request updates", description: "Approvals, rejections, and reminders." },
  { id: "expense", label: "Expense claim updates", description: "Approvals and reimbursement status." },
  { id: "attendance", label: "Attendance alerts", description: "Missed check-in/check-out reminders." },
  { id: "announcements", label: "Company announcements", description: "Holiday notices, policy updates, events." },
] as const;

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [prefs, setPrefs] = React.useState<Record<string, boolean>>({
    leave: true,
    expense: true,
    attendance: true,
    announcements: false,
  });

  const [passwordDialogOpen, setPasswordDialogOpen] = React.useState(false);
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [passwordError, setPasswordError] = React.useState<string | null>(null);
  const [changingPassword, setChangingPassword] = React.useState(false);

  function openPasswordDialog() {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordError(null);
    setPasswordDialogOpen(true);
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError(null);

    if (newPassword.length < 12) {
      setPasswordError("New password must be at least 12 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New password and confirmation don't match.");
      return;
    }

    setChangingPassword(true);
    try {
      await changePassword(currentPassword, newPassword);
      toast.success("Password changed", {
        description: "You've been kept signed in here; your other sessions were signed out.",
      });
      setPasswordDialogOpen(false);
    } catch (err) {
      setPasswordError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setChangingPassword(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="Settings" description="App preferences for your account." />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Appearance</CardTitle>
          <CardDescription>Choose how HRM V2 looks on this device.</CardDescription>
        </CardHeader>
        <CardContent>
          <ToggleGroup
            type="single"
            value={theme}
            onValueChange={(v) => v && setTheme(v)}
            variant="outline"
            className="justify-start"
          >
            <ToggleGroupItem value="light" aria-label="Light theme">
              <Sun /> Light
            </ToggleGroupItem>
            <ToggleGroupItem value="dark" aria-label="Dark theme">
              <Moon /> Dark
            </ToggleGroupItem>
            <ToggleGroupItem value="system" aria-label="System theme">
              <Monitor /> System
            </ToggleGroupItem>
          </ToggleGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notifications</CardTitle>
          <CardDescription>Choose what you get notified about.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {NOTIF_PREFS.map((pref, i) => (
            <React.Fragment key={pref.id}>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label htmlFor={pref.id} className="text-sm font-medium">
                    {pref.label}
                  </Label>
                  <p className="text-muted-foreground text-xs">{pref.description}</p>
                </div>
                <Switch
                  id={pref.id}
                  checked={prefs[pref.id]}
                  onCheckedChange={(checked) =>
                    setPrefs((p) => ({ ...p, [pref.id]: checked }))
                  }
                />
              </div>
              {i < NOTIF_PREFS.length - 1 && <Separator />}
            </React.Fragment>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Security</CardTitle>
          <CardDescription>Manage how you sign in.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={openPasswordDialog}>
            <KeyRound />
            Change password
          </Button>
        </CardContent>
      </Card>

      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent>
          <form onSubmit={handleChangePassword}>
            <DialogHeader>
              <DialogTitle>Change password</DialogTitle>
              <DialogDescription>
                Changing your password signs you out of every other session — this one stays
                signed in.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {passwordError && (
                <Alert variant="destructive">
                  <AlertDescription>{passwordError}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Label htmlFor="current-password">Current password</Label>
                <Input
                  id="current-password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">New password</Label>
                <Input
                  id="new-password"
                  type="password"
                  required
                  minLength={12}
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <p className="text-muted-foreground text-xs">At least 12 characters.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm new password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  required
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setPasswordDialogOpen(false)}
                disabled={changingPassword}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={changingPassword}>
                {changingPassword ? "Changing…" : "Change password"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
