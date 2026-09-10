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
  type CompanySettings,
} from "@/lib/api/admin";
import { PageHeader } from "@/components/hrm/page-header";
import { AsyncSection } from "@/components/hrm/async-section";
import { CardSkeleton } from "@/components/hrm/loading-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

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
          </>
        )}
      </AsyncSection>
    </div>
  );
}
