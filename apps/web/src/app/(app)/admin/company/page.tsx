"use client";

import * as React from "react";
import { toast } from "sonner";
import { useAsync } from "@/lib/use-async";
import { getCompanyProfile, updateCompanyProfile } from "@/lib/mock/mock-api";
import type { CompanyProfile } from "@/lib/mock/hr-fixtures";
import { PageHeader } from "@/components/hrm/page-header";
import { AsyncSection } from "@/components/hrm/async-section";
import { CardSkeleton } from "@/components/hrm/loading-state";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

/**
 * A separate component so its `form` state can be initialized directly from
 * `initial` at mount time - it only mounts once the fetch has resolved, so
 * there's no need to sync state from a prop via an effect.
 */
function CompanyProfileForm({ initial }: { initial: CompanyProfile }) {
  const [form, setForm] = React.useState(initial);
  const [saving, setSaving] = React.useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await updateCompanyProfile(form);
    setSaving(false);
    toast.success("Company settings updated");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Company profile</CardTitle>
        <CardDescription>Visible on payslips, notifications, and this admin panel.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSave}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Legal name</Label>
              <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
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

export default function CompanySettingsPage() {
  const { data, loading, error, refetch } = useAsync(getCompanyProfile);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="Company settings" description="Manage your company's profile and contact information." />

      <AsyncSection
        loading={loading}
        error={error}
        onRetry={refetch}
        loadingFallback={<CardSkeleton lines={6} />}
      >
        {data && <CompanyProfileForm initial={data} />}
      </AsyncSection>
    </div>
  );
}
