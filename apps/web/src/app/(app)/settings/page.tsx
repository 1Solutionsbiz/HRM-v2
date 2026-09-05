"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { KeyRound, Monitor, Moon, Sun } from "lucide-react";
import { PageHeader } from "@/components/hrm/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";

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
          <Button
            variant="outline"
            onClick={() => toast.info("Password change isn't wired up yet - no real auth exists.")}
          >
            <KeyRound />
            Change password
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
