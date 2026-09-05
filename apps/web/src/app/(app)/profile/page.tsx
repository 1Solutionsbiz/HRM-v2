"use client";

import * as React from "react";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { useAsync } from "@/lib/use-async";
import { ApiError } from "@/lib/api-client";
import {
  getMyProfile,
  updateMyProfile,
  employeeFullName,
  employeeInitials,
  titleCase,
  formatBloodGroup,
  maskAccountNumber,
  type EmployeeDetail,
  type Gender,
  type MaritalStatus,
} from "@/lib/api/employees";
import { formatDate, toDateOnlyString } from "@/lib/format";
import { PageHeader } from "@/components/hrm/page-header";
import { AsyncSection } from "@/components/hrm/async-section";
import { CardSkeleton } from "@/components/hrm/loading-state";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DatePicker } from "@/components/ui/date-picker";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="text-sm font-medium">{value || "—"}</p>
    </div>
  );
}

interface FormState {
  personalEmail: string;
  phone: string;
  dateOfBirth: Date | undefined;
  currentAddress: string;
  gender: string;
  nationality: string;
  religion: string;
  maritalStatus: string;
  bloodGroup: string;
}

function toForm(employee: EmployeeDetail): FormState {
  return {
    personalEmail: employee.personalEmail ?? "",
    phone: employee.phone ?? "",
    dateOfBirth: employee.dateOfBirth ? new Date(employee.dateOfBirth) : undefined,
    currentAddress: employee.currentAddress ?? "",
    gender: employee.gender ?? "",
    nationality: employee.nationality ?? "",
    religion: employee.religion ?? "",
    maritalStatus: employee.maritalStatus ?? "",
    bloodGroup: employee.bloodGroup ?? "",
  };
}

/**
 * Only ever mounted while the dialog is open (see ProfilePage below) -
 * useState's lazy initializer then gives fresh draft state every time it
 * opens, with no effect needed to "reset on reopen."
 */
function EditProfileDialog({
  employee,
  onClose,
  onSaved,
}: {
  employee: EmployeeDetail;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = React.useState<FormState>(() => toForm(employee));
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      await updateMyProfile({
        personalEmail: form.personalEmail.trim() || undefined,
        phone: form.phone.trim() || undefined,
        dateOfBirth: form.dateOfBirth ? toDateOnlyString(form.dateOfBirth) : undefined,
        currentAddress: form.currentAddress.trim() || undefined,
        gender: (form.gender || undefined) as Gender | undefined,
        nationality: form.nationality.trim() || undefined,
        religion: form.religion.trim() || undefined,
        maritalStatus: (form.maritalStatus || undefined) as MaritalStatus | undefined,
        bloodGroup: form.bloodGroup || undefined,
      });
      toast.success("Profile updated");
      onClose();
      onSaved();
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : "Couldn't save your changes. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit personal details</DialogTitle>
          <DialogDescription>
            Name, employee ID, and employment details are managed by HR and aren&apos;t editable here.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {saveError && (
            <Alert variant="destructive">
              <AlertDescription>{saveError}</AlertDescription>
            </Alert>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="edit-email">Personal email</Label>
              <Input
                id="edit-email"
                type="email"
                value={form.personalEmail}
                onChange={(e) => setForm((f) => ({ ...f, personalEmail: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-phone">Phone</Label>
              <Input
                id="edit-phone"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Date of birth</Label>
              <DatePicker
                value={form.dateOfBirth}
                onChange={(d) => setForm((f) => ({ ...f, dateOfBirth: d }))}
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <Label>Gender</Label>
              <Select value={form.gender} onValueChange={(v) => setForm((f) => ({ ...f, gender: v }))}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MALE">Male</SelectItem>
                  <SelectItem value="FEMALE">Female</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Marital status</Label>
              <Select
                value={form.maritalStatus}
                onValueChange={(v) => setForm((f) => ({ ...f, maritalStatus: v }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SINGLE">Single</SelectItem>
                  <SelectItem value="MARRIED">Married</SelectItem>
                  <SelectItem value="DIVORCED">Divorced</SelectItem>
                  <SelectItem value="WIDOWED">Widowed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Blood group</Label>
              <Select value={form.bloodGroup} onValueChange={(v) => setForm((f) => ({ ...f, bloodGroup: v }))}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {["A_POSITIVE", "A_NEGATIVE", "B_POSITIVE", "B_NEGATIVE", "AB_POSITIVE", "AB_NEGATIVE", "O_POSITIVE", "O_NEGATIVE"].map(
                    (bg) => (
                      <SelectItem key={bg} value={bg}>
                        {formatBloodGroup(bg)}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-nationality">Nationality</Label>
              <Input
                id="edit-nationality"
                value={form.nationality}
                onChange={(e) => setForm((f) => ({ ...f, nationality: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-religion">Religion</Label>
              <Input
                id="edit-religion"
                value={form.religion}
                onChange={(e) => setForm((f) => ({ ...f, religion: e.target.value }))}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-address">Current address</Label>
            <Textarea
              id="edit-address"
              rows={2}
              value={form.currentAddress}
              onChange={(e) => setForm((f) => ({ ...f, currentAddress: e.target.value }))}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ProfilePage() {
  const { data: employee, loading, error, refetch } = useAsync(getMyProfile);
  const [editOpen, setEditOpen] = React.useState(false);

  return (
    <div className="space-y-6">
      <PageHeader title="Profile" description="Your personal and employment information." />

      <AsyncSection loading={loading} error={error} onRetry={refetch} loadingFallback={<CardSkeleton lines={4} />}>
        {employee && (
          <>
            <Card>
              <CardContent className="flex flex-col items-center gap-3 pt-6 text-center sm:flex-row sm:text-left">
                <Avatar className="size-16">
                  <AvatarFallback className="text-lg">{employeeInitials(employee)}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="text-lg font-semibold">{employeeFullName(employee)}</p>
                  <p className="text-muted-foreground text-sm">
                    {employee.designation?.title ?? "—"} · {employee.department?.name ?? "—"}
                  </p>
                  <p className="text-muted-foreground text-xs">{employee.employeeCode}</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                  <Pencil />
                  Edit personal details
                </Button>
              </CardContent>
            </Card>

            <Tabs defaultValue="personal" className="mt-6">
              <TabsList>
                <TabsTrigger value="personal">Personal</TabsTrigger>
                <TabsTrigger value="employment">Employment</TabsTrigger>
                <TabsTrigger value="bank">Bank & emergency</TabsTrigger>
              </TabsList>

              <TabsContent value="personal" className="mt-4">
                <Card>
                  <CardContent className="grid gap-4 pt-6 sm:grid-cols-2">
                    <Field label="Full name" value={employeeFullName(employee)} />
                    <Field label="Work email" value={employee.user.email} />
                    <Field label="Personal email" value={employee.personalEmail} />
                    <Field label="Phone" value={employee.phone} />
                    <Field
                      label="Date of birth"
                      value={employee.dateOfBirth ? formatDate(employee.dateOfBirth) : null}
                    />
                    <Field label="Gender" value={employee.gender ? titleCase(employee.gender) : null} />
                    <Field
                      label="Marital status"
                      value={employee.maritalStatus ? titleCase(employee.maritalStatus) : null}
                    />
                    <Field label="Blood group" value={employee.bloodGroup ? formatBloodGroup(employee.bloodGroup) : null} />
                    <Field label="Nationality" value={employee.nationality} />
                    <Field label="Religion" value={employee.religion} />
                    <Field label="Current address" value={employee.currentAddress} />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="employment" className="mt-4">
                <Card>
                  <CardContent className="grid gap-4 pt-6 sm:grid-cols-2">
                    <Field label="Employee code" value={employee.employeeCode} />
                    <Field label="Designation" value={employee.designation?.title} />
                    <Field label="Department" value={employee.department?.name} />
                    <Field
                      label="Reporting manager"
                      value={employee.manager ? employeeFullName(employee.manager) : "No manager"}
                    />
                    <Field label="Date of joining" value={formatDate(employee.dateOfJoining)} />
                    <Field label="Employment type" value={titleCase(employee.employmentType)} />
                    <Field label="Work location" value={employee.workLocation} />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="bank" className="mt-4">
                <Card>
                  <CardContent className="grid gap-4 pt-6 sm:grid-cols-2">
                    {employee.bankDetail ? (
                      <>
                        <Field label="Bank" value={employee.bankDetail.bankName} />
                        <Field label="Account number" value={maskAccountNumber(employee.bankDetail.accountNumber)} />
                        <Field label="IFSC" value={employee.bankDetail.ifscCode} />
                      </>
                    ) : (
                      <p className="text-muted-foreground text-sm sm:col-span-2">No bank details on file.</p>
                    )}
                    {employee.emergencyContact ? (
                      <>
                        <Field label="Emergency contact" value={employee.emergencyContact.name} />
                        <Field
                          label="Relationship / phone"
                          value={`${employee.emergencyContact.relationship} · ${employee.emergencyContact.phone}`}
                        />
                      </>
                    ) : (
                      <p className="text-muted-foreground text-sm sm:col-span-2">No emergency contact on file.</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            {editOpen && (
              <EditProfileDialog
                employee={employee}
                onClose={() => setEditOpen(false)}
                onSaved={refetch}
              />
            )}
          </>
        )}
      </AsyncSection>
    </div>
  );
}
