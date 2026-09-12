"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { Bell, BellOff, CheckCircle2, Download, KeyRound, Monitor, Moon, Share, Sun } from "lucide-react";
import { ApiError } from "@/lib/api-client";
import { changePassword } from "@/lib/api/auth";
import { useInstallPrompt } from "@/lib/use-install-prompt";
import { usePushNotifications } from "@/lib/use-push-notifications";
import { PageHeader } from "@/components/hrm/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { canInstall, isIos, isInstalled, promptInstall } = useInstallPrompt();
  const {
    supported: pushSupported,
    permission: pushPermission,
    isSubscribed: pushSubscribed,
    busy: pushBusy,
    error: pushError,
    subscribe: enablePush,
    unsubscribe: disablePush,
  } = usePushNotifications();

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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">App</CardTitle>
          <CardDescription>Install HRM V2 on this device for quicker access.</CardDescription>
        </CardHeader>
        <CardContent>
          {isInstalled ? (
            <p className="text-muted-foreground flex items-center gap-2 text-sm">
              <CheckCircle2 className="size-4" />
              Already installed on this device.
            </p>
          ) : isIos ? (
            <p className="flex items-start gap-2 text-sm">
              <Share className="mt-0.5 size-4 shrink-0" />
              Tap <strong>Share</strong>, then <strong>Add to Home Screen</strong>.
            </p>
          ) : canInstall ? (
            <Button variant="outline" onClick={promptInstall}>
              <Download />
              Install app
            </Button>
          ) : (
            <p className="text-muted-foreground text-sm">
              Not available in this browser yet — try Chrome or Edge, or open this page on your phone.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notifications</CardTitle>
          <CardDescription>Get alerted on this device even when HRM isn&apos;t open.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {pushError && (
            <Alert variant="destructive">
              <AlertDescription>{pushError}</AlertDescription>
            </Alert>
          )}
          {!pushSupported ? (
            <p className="text-muted-foreground text-sm">
              Not available in this browser.{" "}
              {isIos
                ? "On iPhone/iPad, add HRM to your Home Screen first (Share → Add to Home Screen), then reopen it from there."
                : "Try Chrome or Edge, or open this page on your phone."}
            </p>
          ) : pushPermission === "denied" ? (
            <p className="text-muted-foreground text-sm">
              Blocked in your browser&apos;s site settings. Allow notifications for this site there, then reload this page.
            </p>
          ) : pushSubscribed ? (
            <div className="flex items-center justify-between gap-3">
              <p className="text-muted-foreground flex items-center gap-2 text-sm">
                <CheckCircle2 className="size-4" />
                Enabled on this device.
              </p>
              <Button variant="outline" size="sm" onClick={disablePush} disabled={pushBusy}>
                <BellOff />
                {pushBusy ? "Disabling…" : "Disable"}
              </Button>
            </div>
          ) : (
            <Button
              onClick={enablePush}
              disabled={pushBusy}
              className="bg-success text-success-foreground hover:bg-success/90 focus-visible:ring-success/40"
            >
              <Bell />
              {pushBusy ? "Enabling…" : "Enable push notifications"}
            </Button>
          )}
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
