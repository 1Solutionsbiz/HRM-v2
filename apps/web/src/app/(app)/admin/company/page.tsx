"use client";

import * as React from "react";
import { toast } from "sonner";
import { MapPin } from "lucide-react";
import { useAsync } from "@/lib/use-async";
import { ApiError } from "@/lib/api-client";
import { getCurrentLocation } from "@/lib/geolocation";
import {
  getCompanySettings,
  updateCompanySettings,
  updateGeofenceSettings,
  updateDailyReportPolicy,
  getDesignations,
  updateDesignationTemplate,
  type CompanySettings,
  type DesignationRow,
} from "@/lib/api/admin";
import { formatDailyReportTemplate, type DailyReportTemplate } from "@/lib/api/daily-reports";
import { PageHeader } from "@/components/hrm/page-header";
import { AsyncSection } from "@/components/hrm/async-section";
import { CardSkeleton } from "@/components/hrm/loading-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface FormState {
  legalName: string;
  brandName: string;
  website: string;
  supportEmail: string;
  phone: string;
  address: string;
  timezone: string;
}

function toForm(settings: CompanySettings): FormState {
  return {
    legalName: settings.legalName,
    brandName: settings.brandName,
    website: settings.website ?? "",
    supportEmail: settings.supportEmail,
    phone: settings.phone ?? "",
    address: settings.address ?? "",
    timezone: settings.timezone,
  };
}

/**
 * A separate component so its `form` state can be initialized directly from
 * `initial` at mount time - it only mounts once the fetch has resolved, so
 * there's no need to sync state from a prop via an effect.
 */
function CompanyProfileForm({ initial }: { initial: CompanySettings }) {
  const [form, setForm] = React.useState(toForm(initial));
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    try {
      await updateCompanySettings({
        legalName: form.legalName.trim(),
        brandName: form.brandName.trim(),
        website: form.website.trim() || undefined,
        supportEmail: form.supportEmail.trim(),
        phone: form.phone.trim() || undefined,
        address: form.address.trim() || undefined,
      });
      toast.success("Company settings updated");
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : "Couldn't save these changes. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Company profile</CardTitle>
        <CardDescription>Visible on payslips, notifications, and this admin panel.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSave}>
          {saveError && (
            <Alert variant="destructive">
              <AlertDescription>{saveError}</AlertDescription>
            </Alert>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Legal name</Label>
              <Input id="name" value={form.legalName} onChange={(e) => setForm({ ...form, legalName: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="brandName">Brand name</Label>
              <Input id="brandName" value={form.brandName} onChange={(e) => setForm({ ...form, brandName: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="website">Website</Label>
              <Input id="website" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supportEmail">Support email</Label>
              <Input
                id="supportEmail"
                type="email"
                value={form.supportEmail}
                onChange={(e) => setForm({ ...form, supportEmail: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Input id="timezone" value={form.timezone} disabled />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">Registered address</Label>
            <Input id="address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

interface GeofenceFormState {
  latitude: string;
  longitude: string;
  radiusMeters: string;
}

function toGeofenceForm(settings: CompanySettings): GeofenceFormState {
  return {
    latitude: settings.geofenceLatitude != null ? String(settings.geofenceLatitude) : "",
    longitude: settings.geofenceLongitude != null ? String(settings.geofenceLongitude) : "",
    radiusMeters: settings.geofenceRadiusMeters != null ? String(settings.geofenceRadiusMeters) : "",
  };
}

/**
 * A separate card/form/endpoint from CompanyProfileForm above - see
 * AdminService.updateGeofenceSettings for why they can't share one PUT.
 */
function GeofenceSettingsForm({ initial, onSaved }: { initial: CompanySettings; onSaved: () => void }) {
  const [form, setForm] = React.useState(toGeofenceForm(initial));
  const [saving, setSaving] = React.useState(false);
  const [locating, setLocating] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  const isEnabled = !!(initial.geofenceLatitude && initial.geofenceLongitude && initial.geofenceRadiusMeters);
  const filledCount = [form.latitude, form.longitude, form.radiusMeters].filter((v) => v.trim()).length;

  async function handleUseCurrentLocation() {
    setLocating(true);
    setSaveError(null);
    try {
      const location = await getCurrentLocation();
      if (!location) {
        setSaveError("Couldn't get your current location. Check your browser's location permission and try again.");
        return;
      }
      setForm((f) => ({ ...f, latitude: String(location.latitude), longitude: String(location.longitude) }));
    } finally {
      setLocating(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (filledCount > 0 && filledCount < 3) {
      setSaveError("Set latitude, longitude, and radius together, or clear all three to turn geofencing off.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      await updateGeofenceSettings({
        latitude: form.latitude.trim() ? Number(form.latitude) : undefined,
        longitude: form.longitude.trim() ? Number(form.longitude) : undefined,
        radiusMeters: form.radiusMeters.trim() ? Number(form.radiusMeters) : undefined,
      });
      toast.success(filledCount === 0 ? "Attendance geofencing turned off" : "Attendance geofencing updated");
      onSaved();
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : "Couldn't save these changes. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function handleTurnOff() {
    setForm({ latitude: "", longitude: "", radiusMeters: "" });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Attendance geofencing</CardTitle>
        <CardDescription>
          {isEnabled
            ? `On — employees must be within ${initial.geofenceRadiusMeters}m of this location to check in or out.`
            : "Off — attendance can currently be marked from anywhere."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSave}>
          {saveError && (
            <Alert variant="destructive">
              <AlertDescription>{saveError}</AlertDescription>
            </Alert>
          )}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="geofence-lat">Latitude</Label>
              <Input
                id="geofence-lat"
                type="number"
                step="any"
                placeholder="e.g. 28.6139"
                value={form.latitude}
                onChange={(e) => setForm((f) => ({ ...f, latitude: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="geofence-lng">Longitude</Label>
              <Input
                id="geofence-lng"
                type="number"
                step="any"
                placeholder="e.g. 77.2090"
                value={form.longitude}
                onChange={(e) => setForm((f) => ({ ...f, longitude: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="geofence-radius">Radius (meters)</Label>
              <Input
                id="geofence-radius"
                type="number"
                min={20}
                max={5000}
                placeholder="e.g. 150"
                value={form.radiusMeters}
                onChange={(e) => setForm((f) => ({ ...f, radiusMeters: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={handleUseCurrentLocation} disabled={locating}>
              <MapPin />
              {locating ? "Locating…" : "Use my current location"}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
            {filledCount > 0 && (
              <Button type="button" variant="ghost" onClick={handleTurnOff} disabled={saving}>
                Turn off geofencing
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

interface DailyReportPolicyFormState {
  required: boolean;
  deadline: string;
  graceMinutes: string;
}

function toDailyReportPolicyForm(settings: CompanySettings): DailyReportPolicyFormState {
  let deadline = "";
  if (settings.dailyReportDeadline) {
    // A MySQL TIME column, anchored at the Unix epoch in UTC regardless of
    // host timezone - same UTC-getter convention as the backend reads it
    // with (see AdminService.updateDailyReportPolicy).
    const d = new Date(settings.dailyReportDeadline);
    deadline = `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
  }
  return {
    required: settings.dailyReportRequired,
    deadline,
    graceMinutes: settings.dailyReportGraceMinutes != null ? String(settings.dailyReportGraceMinutes) : "",
  };
}

/**
 * Deliberately deployed OFF (dailyReportRequired defaults to false) - this
 * form is the only way to turn it on, and turning it on is rejected
 * server-side without a deadline configured first (see
 * AdminService.updateDailyReportPolicy).
 */
function DailyReportPolicyForm({ initial, onSaved }: { initial: CompanySettings; onSaved: () => void }) {
  const [form, setForm] = React.useState(toDailyReportPolicyForm(initial));
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (form.required && !form.deadline) {
      setSaveError("Set a deadline before turning Daily Report Required on.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      await updateDailyReportPolicy({
        required: form.required,
        deadline: form.deadline || undefined,
        graceMinutes: form.graceMinutes.trim() ? Number(form.graceMinutes) : undefined,
      });
      toast.success(form.required ? "Daily Work Report requirement enabled" : "Daily Work Report requirement disabled");
      onSaved();
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : "Couldn't save these changes. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Daily Work Report policy</CardTitle>
        <CardDescription>
          {initial.dailyReportRequired
            ? `On — required employees must submit by ${form.deadline || "—"}${
                initial.dailyReportGraceMinutes ? ` (+${initial.dailyReportGraceMinutes}m grace)` : ""
              }.`
            : "Off — no employee is currently required to submit a Daily Work Report."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSave}>
          {saveError && (
            <Alert variant="destructive">
              <AlertDescription>{saveError}</AlertDescription>
            </Alert>
          )}
          <div className="flex items-center gap-3">
            <Switch
              id="dr-required"
              checked={form.required}
              onCheckedChange={(v) => setForm((f) => ({ ...f, required: v }))}
            />
            <Label htmlFor="dr-required">Daily Report Required</Label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="dr-deadline">Deadline</Label>
              <Input
                id="dr-deadline"
                type="time"
                value={form.deadline}
                onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dr-grace">Grace period (minutes)</Label>
              <Input
                id="dr-grace"
                type="number"
                min={0}
                max={240}
                placeholder="e.g. 30"
                value={form.graceMinutes}
                onChange={(e) => setForm((f) => ({ ...f, graceMinutes: e.target.value }))}
              />
            </div>
          </div>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

const DAILY_REPORT_TEMPLATE_VALUES: DailyReportTemplate[] = [
  "GENERAL",
  "DEVELOPMENT",
  "SEO",
  "SOCIAL_MEDIA",
  "SALES",
  "HR",
];

/**
 * A separate fetch/card from the settings form above it - designations
 * aren't part of CompanySettings, and each row auto-saves on change (no
 * "Save changes" button) since a template pick is low-stakes and instantly
 * reversible, same reasoning as the Projects admin page's archive toggle.
 * An employee's own dailyReportTemplateOverride (set on their profile)
 * always wins over whatever's picked here - see DailyReportsService's
 * template-resolution comment.
 */
function DailyReportTemplatesCard() {
  const { data, loading, error, refetch } = useAsync(getDesignations);
  const [savingId, setSavingId] = React.useState<string | null>(null);

  async function handleChange(designation: DesignationRow, value: string) {
    const template = value === "GENERAL" ? null : (value as DailyReportTemplate);
    setSavingId(designation.id);
    try {
      await updateDesignationTemplate(designation.id, template);
      toast.success(`${designation.title} → ${formatDailyReportTemplate(template ?? "GENERAL")}`);
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't update this designation's template.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Daily Report templates</CardTitle>
        <CardDescription>
          The default Daily Work Report template per designation. A per-employee override, set on their profile,
          always wins over this.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <AsyncSection
          loading={loading}
          error={error}
          onRetry={refetch}
          loadingFallback={<Skeleton className="h-40 w-full" />}
        >
          {(data ?? []).length === 0 ? (
            <p className="text-muted-foreground text-sm">No designations configured yet.</p>
          ) : (
            <ul className="divide-y">
              {(data ?? []).map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{d.title}</p>
                    <p className="text-muted-foreground text-xs">{d.department.name}</p>
                  </div>
                  <Select
                    value={d.dailyReportTemplate ?? "GENERAL"}
                    onValueChange={(v) => handleChange(d, v)}
                    disabled={savingId === d.id}
                  >
                    <SelectTrigger className="w-[160px] shrink-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DAILY_REPORT_TEMPLATE_VALUES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {formatDailyReportTemplate(t)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </li>
              ))}
            </ul>
          )}
        </AsyncSection>
      </CardContent>
    </Card>
  );
}

export default function CompanySettingsPage() {
  const { data, loading, error, refetch } = useAsync(getCompanySettings);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="Company settings" description="Manage your company's profile and contact information." />

      <AsyncSection
        loading={loading}
        error={error}
        onRetry={refetch}
        loadingFallback={<CardSkeleton lines={6} />}
      >
        {data && (
          <>
            <CompanyProfileForm initial={data} />
            <GeofenceSettingsForm initial={data} onSaved={refetch} />
            <DailyReportPolicyForm initial={data} onSaved={refetch} />
            <DailyReportTemplatesCard />
          </>
        )}
      </AsyncSection>
    </div>
  );
}
