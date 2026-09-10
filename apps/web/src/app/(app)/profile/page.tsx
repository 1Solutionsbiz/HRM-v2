"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ChevronLeft, IdCard, Users, Briefcase, ShieldAlert, Pencil, Plus, Trash2, Baby, HeartHandshake, BadgeCheck, Camera, Loader2 } from "lucide-react";
import { useAsync } from "@/lib/use-async";
import { ApiError } from "@/lib/api-client";
import {
  getMyProfile,
  updateMyProfile,
  uploadMyAvatar,
  upsertMyIdentification,
  upsertMyFamilyDetail,
  addMyFamilyMember,
  updateMyFamilyMember,
  removeMyFamilyMember,
  addMyPreviousEmployer,
  updateMyPreviousEmployer,
  removeMyPreviousEmployer,
  addMyEmergencyContact,
  updateMyEmergencyContact,
  removeMyEmergencyContact,
  employeeFullName,
  employeeInitials,
  titleCase,
  formatBloodGroup,
  maskAccountNumber,
  type EmployeeDetail,
  type EmployeeFamilyMember,
  type EmployeePreviousEmployer,
  type EmergencyContact,
  type FamilyMemberKind,
  type Gender,
  type MaritalStatus,
} from "@/lib/api/employees";
import { formatDate, toDateOnlyString } from "@/lib/format";
import { PageHeader } from "@/components/hrm/page-header";
import { AsyncSection } from "@/components/hrm/async-section";
import { EmptyState } from "@/components/hrm/empty-state";
import { CardSkeleton } from "@/components/hrm/loading-state";
import { ConfirmDialog } from "@/components/hrm/confirm-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DatePicker, DateOfBirthPicker } from "@/components/ui/date-picker";
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
  permanentAddress: string;
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
    permanentAddress: employee.permanentAddress ?? "",
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
        permanentAddress: form.permanentAddress.trim() || undefined,
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
              <DateOfBirthPicker
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
          <div className="space-y-2">
            <Label htmlFor="edit-permanent-address">Permanent address</Label>
            <Textarea
              id="edit-permanent-address"
              rows={2}
              value={form.permanentAddress}
              onChange={(e) => setForm((f) => ({ ...f, permanentAddress: e.target.value }))}
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

interface IdentificationFormState {
  panNumber: string;
  aadhaarNumber: string;
  passportNumber: string;
  passportExpiryDate: Date | undefined;
  drivingLicenseNumber: string;
  drivingLicenseExpiryDate: Date | undefined;
}

function toIdentificationForm(employee: EmployeeDetail): IdentificationFormState {
  const id = employee.identification;
  return {
    panNumber: id?.panNumber ?? "",
    aadhaarNumber: id?.aadhaarNumber ?? "",
    passportNumber: id?.passportNumber ?? "",
    passportExpiryDate: id?.passportExpiryDate ? new Date(id.passportExpiryDate) : undefined,
    drivingLicenseNumber: id?.drivingLicenseNumber ?? "",
    drivingLicenseExpiryDate: id?.drivingLicenseExpiryDate ? new Date(id.drivingLicenseExpiryDate) : undefined,
  };
}

function IdentificationDialog({
  employee,
  onClose,
  onSaved,
}: {
  employee: EmployeeDetail;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = React.useState<IdentificationFormState>(() => toIdentificationForm(employee));
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      await upsertMyIdentification({
        panNumber: form.panNumber.trim().toUpperCase(),
        aadhaarNumber: form.aadhaarNumber.trim(),
        passportNumber: form.passportNumber.trim() || undefined,
        passportExpiryDate: form.passportExpiryDate ? toDateOnlyString(form.passportExpiryDate) : undefined,
        drivingLicenseNumber: form.drivingLicenseNumber.trim() || undefined,
        drivingLicenseExpiryDate: form.drivingLicenseExpiryDate
          ? toDateOnlyString(form.drivingLicenseExpiryDate)
          : undefined,
      });
      toast.success("Identification details updated");
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
          <DialogTitle>Identification details</DialogTitle>
          <DialogDescription>PAN and Aadhaar are required.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {saveError && (
            <Alert variant="destructive">
              <AlertDescription>{saveError}</AlertDescription>
            </Alert>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="id-pan">PAN no. *</Label>
              <Input
                id="id-pan"
                value={form.panNumber}
                maxLength={10}
                placeholder="AAAAA9999A"
                onChange={(e) => setForm((f) => ({ ...f, panNumber: e.target.value.toUpperCase() }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="id-aadhaar">Aadhaar no. *</Label>
              <Input
                id="id-aadhaar"
                value={form.aadhaarNumber}
                maxLength={12}
                placeholder="12-digit number"
                onChange={(e) => setForm((f) => ({ ...f, aadhaarNumber: e.target.value.replace(/\D/g, "") }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="id-passport">Passport no.</Label>
              <Input
                id="id-passport"
                value={form.passportNumber}
                onChange={(e) => setForm((f) => ({ ...f, passportNumber: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Passport expiry date</Label>
              <DatePicker
                value={form.passportExpiryDate}
                onChange={(d) => setForm((f) => ({ ...f, passportExpiryDate: d }))}
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="id-dl">Driving license no.</Label>
              <Input
                id="id-dl"
                value={form.drivingLicenseNumber}
                onChange={(e) => setForm((f) => ({ ...f, drivingLicenseNumber: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Driving license expiry date</Label>
              <DatePicker
                value={form.drivingLicenseExpiryDate}
                onChange={(d) => setForm((f) => ({ ...f, drivingLicenseExpiryDate: d }))}
                className="w-full"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !form.panNumber.trim() || !form.aadhaarNumber.trim()}
          >
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface FamilyDetailFormState {
  fatherName: string;
  fatherDateOfBirth: Date | undefined;
  motherName: string;
  motherDateOfBirth: Date | undefined;
}

function toFamilyDetailForm(employee: EmployeeDetail): FamilyDetailFormState {
  const fd = employee.familyDetail;
  return {
    fatherName: fd?.fatherName ?? "",
    fatherDateOfBirth: fd?.fatherDateOfBirth ? new Date(fd.fatherDateOfBirth) : undefined,
    motherName: fd?.motherName ?? "",
    motherDateOfBirth: fd?.motherDateOfBirth ? new Date(fd.motherDateOfBirth) : undefined,
  };
}

function FamilyDetailDialog({
  employee,
  onClose,
  onSaved,
}: {
  employee: EmployeeDetail;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = React.useState<FamilyDetailFormState>(() => toFamilyDetailForm(employee));
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      await upsertMyFamilyDetail({
        fatherName: form.fatherName.trim() || undefined,
        fatherDateOfBirth: form.fatherDateOfBirth ? toDateOnlyString(form.fatherDateOfBirth) : undefined,
        motherName: form.motherName.trim() || undefined,
        motherDateOfBirth: form.motherDateOfBirth ? toDateOnlyString(form.motherDateOfBirth) : undefined,
      });
      toast.success("Family details updated");
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Family details</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {saveError && (
            <Alert variant="destructive">
              <AlertDescription>{saveError}</AlertDescription>
            </Alert>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="fd-father-name">Father&apos;s name</Label>
              <Input
                id="fd-father-name"
                value={form.fatherName}
                onChange={(e) => setForm((f) => ({ ...f, fatherName: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Father&apos;s date of birth</Label>
              <DateOfBirthPicker
                value={form.fatherDateOfBirth}
                onChange={(d) => setForm((f) => ({ ...f, fatherDateOfBirth: d }))}
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fd-mother-name">Mother&apos;s name</Label>
              <Input
                id="fd-mother-name"
                value={form.motherName}
                onChange={(e) => setForm((f) => ({ ...f, motherName: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Mother&apos;s date of birth</Label>
              <DateOfBirthPicker
                value={form.motherDateOfBirth}
                onChange={(d) => setForm((f) => ({ ...f, motherDateOfBirth: d }))}
                className="w-full"
              />
            </div>
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

const FAMILY_MEMBER_KIND_LABELS: Record<FamilyMemberKind, string> = {
  CHILD: "Child",
  OTHER_DEPENDENT: "Dependent",
  NOMINEE: "Nominee",
};

interface FamilyMemberFormState {
  name: string;
  relationship: string;
  dateOfBirth: Date | undefined;
  sharePercentage: string;
}

function toFamilyMemberForm(member: EmployeeFamilyMember | null): FamilyMemberFormState {
  return {
    name: member?.name ?? "",
    relationship: member?.relationship ?? "",
    dateOfBirth: member?.dateOfBirth ? new Date(member.dateOfBirth) : undefined,
    sharePercentage: member?.sharePercentage != null ? String(member.sharePercentage) : "",
  };
}

function FamilyMemberDialog({
  kind,
  member,
  onClose,
  onSaved,
}: {
  kind: FamilyMemberKind;
  member: EmployeeFamilyMember | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = React.useState<FamilyMemberFormState>(() => toFamilyMemberForm(member));
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      const payload = {
        name: form.name.trim(),
        relationship: form.relationship.trim() || undefined,
        dateOfBirth: form.dateOfBirth ? toDateOnlyString(form.dateOfBirth) : undefined,
        sharePercentage:
          kind === "NOMINEE" && form.sharePercentage.trim() ? Number(form.sharePercentage) : undefined,
      };
      if (member) {
        await updateMyFamilyMember(kind, member.id, payload);
      } else {
        await addMyFamilyMember(kind, payload);
      }
      toast.success(`${FAMILY_MEMBER_KIND_LABELS[kind]} ${member ? "updated" : "added"}`);
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {member ? "Edit" : "Add"} {FAMILY_MEMBER_KIND_LABELS[kind].toLowerCase()}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {saveError && (
            <Alert variant="destructive">
              <AlertDescription>{saveError}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor="fm-name">Name *</Label>
            <Input
              id="fm-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          {kind !== "CHILD" && (
            <div className="space-y-2">
              <Label htmlFor="fm-relationship">Relationship</Label>
              <Input
                id="fm-relationship"
                value={form.relationship}
                onChange={(e) => setForm((f) => ({ ...f, relationship: e.target.value }))}
              />
            </div>
          )}
          <div className="space-y-2">
            <Label>Date of birth</Label>
            <DateOfBirthPicker
              value={form.dateOfBirth}
              onChange={(d) => setForm((f) => ({ ...f, dateOfBirth: d }))}
              className="w-full"
            />
          </div>
          {kind === "NOMINEE" && (
            <div className="space-y-2">
              <Label htmlFor="fm-share">Share (%)</Label>
              <Input
                id="fm-share"
                type="number"
                min={0}
                max={100}
                value={form.sharePercentage}
                onChange={(e) => setForm((f) => ({ ...f, sharePercentage: e.target.value }))}
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !form.name.trim()}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface PreviousEmployerFormState {
  companyName: string;
  designation: string;
  fromDate: Date | undefined;
  toDate: Date | undefined;
}

function toPreviousEmployerForm(entry: EmployeePreviousEmployer | null): PreviousEmployerFormState {
  return {
    companyName: entry?.companyName ?? "",
    designation: entry?.designation ?? "",
    fromDate: entry?.fromDate ? new Date(entry.fromDate) : undefined,
    toDate: entry?.toDate ? new Date(entry.toDate) : undefined,
  };
}

function PreviousEmployerDialog({
  entry,
  onClose,
  onSaved,
}: {
  entry: EmployeePreviousEmployer | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = React.useState<PreviousEmployerFormState>(() => toPreviousEmployerForm(entry));
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      const payload = {
        companyName: form.companyName.trim(),
        designation: form.designation.trim() || undefined,
        fromDate: form.fromDate ? toDateOnlyString(form.fromDate) : undefined,
        toDate: form.toDate ? toDateOnlyString(form.toDate) : undefined,
      };
      if (entry) {
        await updateMyPreviousEmployer(entry.id, payload);
      } else {
        await addMyPreviousEmployer(payload);
      }
      toast.success(`Previous employer ${entry ? "updated" : "added"}`);
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{entry ? "Edit" : "Add"} previous employer</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {saveError && (
            <Alert variant="destructive">
              <AlertDescription>{saveError}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor="pe-company">Company name *</Label>
            <Input
              id="pe-company"
              value={form.companyName}
              onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pe-designation">Designation</Label>
            <Input
              id="pe-designation"
              value={form.designation}
              onChange={(e) => setForm((f) => ({ ...f, designation: e.target.value }))}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>From</Label>
              <DatePicker
                value={form.fromDate}
                onChange={(d) => setForm((f) => ({ ...f, fromDate: d }))}
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <Label>To</Label>
              <DatePicker
                value={form.toDate}
                onChange={(d) => setForm((f) => ({ ...f, toDate: d }))}
                className="w-full"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !form.companyName.trim()}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface EmergencyContactFormState {
  name: string;
  relationship: string;
  isdCode: string;
  phone: string;
}

function toEmergencyContactForm(contact: EmergencyContact | null): EmergencyContactFormState {
  return {
    name: contact?.name ?? "",
    relationship: contact?.relationship ?? "",
    isdCode: contact?.isdCode ?? "+91",
    phone: contact?.phone ?? "",
  };
}

function EmergencyContactDialog({
  contact,
  onClose,
  onSaved,
}: {
  contact: EmergencyContact | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = React.useState<EmergencyContactFormState>(() => toEmergencyContactForm(contact));
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      const payload = {
        name: form.name.trim(),
        relationship: form.relationship.trim(),
        isdCode: form.isdCode.trim() || undefined,
        phone: form.phone.trim(),
      };
      if (contact) {
        await updateMyEmergencyContact(contact.id, payload);
      } else {
        await addMyEmergencyContact(payload);
      }
      toast.success(`Emergency contact ${contact ? "updated" : "added"}`);
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{contact ? "Edit" : "Add"} emergency contact</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {saveError && (
            <Alert variant="destructive">
              <AlertDescription>{saveError}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor="ec-name">Name *</Label>
            <Input
              id="ec-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ec-relation">Relation *</Label>
            <Input
              id="ec-relation"
              value={form.relationship}
              onChange={(e) => setForm((f) => ({ ...f, relationship: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ec-isd">ISD code</Label>
              <Input
                id="ec-isd"
                value={form.isdCode}
                onChange={(e) => setForm((f) => ({ ...f, isdCode: e.target.value }))}
              />
            </div>
            <div className="col-span-2 space-y-2">
              <Label htmlFor="ec-phone">Contact no. *</Label>
              <Input
                id="ec-phone"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !form.name.trim() || !form.relationship.trim() || !form.phone.trim()}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ProfilePage() {
  const { data: employee, loading, error, refetch } = useAsync(getMyProfile);
  const [editOpen, setEditOpen] = React.useState(false);
  const [uploadingAvatar, setUploadingAvatar] = React.useState(false);
  const [idOpen, setIdOpen] = React.useState(false);
  const [familyDetailOpen, setFamilyDetailOpen] = React.useState(false);
  const [familyMemberDialog, setFamilyMemberDialog] = React.useState<{
    kind: FamilyMemberKind;
    member: EmployeeFamilyMember | null;
  } | null>(null);
  const [familyMemberToDelete, setFamilyMemberToDelete] = React.useState<EmployeeFamilyMember | null>(null);
  const [employerDialog, setEmployerDialog] = React.useState<{ entry: EmployeePreviousEmployer | null } | null>(
    null,
  );
  const [employerToDelete, setEmployerToDelete] = React.useState<EmployeePreviousEmployer | null>(null);
  const [contactDialog, setContactDialog] = React.useState<{ contact: EmergencyContact | null } | null>(null);
  const [contactToDelete, setContactToDelete] = React.useState<EmergencyContact | null>(null);

  const ALLOWED_AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];
  const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
      toast.error("Profile photos must be a JPEG, PNG, or WEBP file.");
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      toast.error("Photo must be smaller than 5 MB.");
      return;
    }
    setUploadingAvatar(true);
    try {
      await uploadMyAvatar(file);
      toast.success("Profile photo updated");
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't upload this photo. Please try again.");
    } finally {
      setUploadingAvatar(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="text-muted-foreground -ml-2.5 mb-2">
          <Link href="/dashboard">
            <ChevronLeft />
            Back
          </Link>
        </Button>
      </div>

      <PageHeader title="Profile" description="Your personal and employment information." />

      <AsyncSection loading={loading} error={error} onRetry={refetch} loadingFallback={<CardSkeleton lines={4} />}>
        {employee && (
          <>
            <Card>
              <CardContent className="flex flex-col items-center gap-3 pt-6 text-center sm:flex-row sm:text-left">
                <div className="relative shrink-0">
                  <Avatar className="size-16">
                    {employee.avatarUrl && <AvatarImage src={employee.avatarUrl} alt="" />}
                    <AvatarFallback className="text-lg">{employeeInitials(employee)}</AvatarFallback>
                  </Avatar>
                  <label
                    htmlFor="avatar-file"
                    aria-label="Change profile photo"
                    className="bg-primary text-primary-foreground hover:bg-primary/90 absolute -right-1 -bottom-1 flex size-6 cursor-pointer items-center justify-center rounded-full border-2 border-background"
                  >
                    {uploadingAvatar ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <Camera className="size-3" />
                    )}
                  </label>
                  <input
                    id="avatar-file"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    disabled={uploadingAvatar}
                    onChange={handleAvatarChange}
                  />
                </div>
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
                <TabsTrigger value="identification">Identification</TabsTrigger>
                <TabsTrigger value="family">Family</TabsTrigger>
                <TabsTrigger value="previous-employer">Previous employer</TabsTrigger>
                <TabsTrigger value="contact">Contact</TabsTrigger>
                <TabsTrigger value="bank">Bank</TabsTrigger>
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
                    <Field label="Permanent address" value={employee.permanentAddress} />
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

              <TabsContent value="identification" className="mt-4">
                <Card>
                  <CardContent className="space-y-4 pt-6">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <IdCard className="text-muted-foreground size-4" />
                        <p className="text-sm font-semibold">Identification details</p>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => setIdOpen(true)}>
                        <Pencil />
                        Edit
                      </Button>
                    </div>
                    {employee.identification ? (
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="PAN no." value={employee.identification.panNumber} />
                        <Field label="Aadhaar no." value={employee.identification.aadhaarNumber} />
                        <Field label="Passport no." value={employee.identification.passportNumber} />
                        <Field
                          label="Passport expiry date"
                          value={
                            employee.identification.passportExpiryDate
                              ? formatDate(employee.identification.passportExpiryDate)
                              : null
                          }
                        />
                        <Field label="Driving license no." value={employee.identification.drivingLicenseNumber} />
                        <Field
                          label="Driving license expiry date"
                          value={
                            employee.identification.drivingLicenseExpiryDate
                              ? formatDate(employee.identification.drivingLicenseExpiryDate)
                              : null
                          }
                        />
                      </div>
                    ) : (
                      <EmptyState
                        size="sm"
                        icon={IdCard}
                        title="Add your PAN and Aadhaar"
                        description="Required for payroll and compliance."
                      />
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="family" className="mt-4 space-y-4">
                <Card>
                  <CardContent className="space-y-4 pt-6">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Users className="text-muted-foreground size-4" />
                        <p className="text-sm font-semibold">Family details</p>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => setFamilyDetailOpen(true)}>
                        <Pencil />
                        Edit
                      </Button>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Father's name" value={employee.familyDetail?.fatherName} />
                      <Field
                        label="Father's date of birth"
                        value={
                          employee.familyDetail?.fatherDateOfBirth
                            ? formatDate(employee.familyDetail.fatherDateOfBirth)
                            : null
                        }
                      />
                      <Field label="Mother's name" value={employee.familyDetail?.motherName} />
                      <Field
                        label="Mother's date of birth"
                        value={
                          employee.familyDetail?.motherDateOfBirth
                            ? formatDate(employee.familyDetail.motherDateOfBirth)
                            : null
                        }
                      />
                      <Field
                        label="Marital status"
                        value={employee.maritalStatus ? titleCase(employee.maritalStatus) : null}
                      />
                    </div>
                  </CardContent>
                </Card>

                {(["CHILD", "OTHER_DEPENDENT", "NOMINEE"] as const).map((kind) => {
                  const members = employee.familyMembers.filter((m) => m.kind === kind);
                  const Icon = kind === "CHILD" ? Baby : kind === "NOMINEE" ? BadgeCheck : HeartHandshake;
                  const sectionTitle =
                    kind === "CHILD" ? "Children" : kind === "NOMINEE" ? "Nominee details" : "Other dependents";
                  return (
                    <Card key={kind}>
                      <CardContent className="space-y-4 pt-6">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Icon className="text-muted-foreground size-4" />
                            <p className="text-sm font-semibold">{sectionTitle}</p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setFamilyMemberDialog({ kind, member: null })}
                          >
                            <Plus />
                            Add {FAMILY_MEMBER_KIND_LABELS[kind].toLowerCase()}
                          </Button>
                        </div>
                        {members.length > 0 ? (
                          <ul className="divide-y">
                            {members.map((m) => (
                              <li key={m.id} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                                <div className="grid flex-1 gap-1 sm:grid-cols-3">
                                  <Field label="Name" value={m.name} />
                                  {kind !== "CHILD" && <Field label="Relationship" value={m.relationship} />}
                                  <Field label="Date of birth" value={m.dateOfBirth ? formatDate(m.dateOfBirth) : null} />
                                  {kind === "NOMINEE" && (
                                    <Field label="Share" value={m.sharePercentage != null ? `${m.sharePercentage}%` : null} />
                                  )}
                                </div>
                                <div className="flex shrink-0 gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setFamilyMemberDialog({ kind, member: m })}
                                  >
                                    <Pencil />
                                  </Button>
                                  <Button variant="ghost" size="icon" onClick={() => setFamilyMemberToDelete(m)}>
                                    <Trash2 />
                                  </Button>
                                </div>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <EmptyState size="sm" icon={Icon} title="None added yet" />
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </TabsContent>

              <TabsContent value="previous-employer" className="mt-4">
                <Card>
                  <CardContent className="space-y-4 pt-6">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Briefcase className="text-muted-foreground size-4" />
                        <p className="text-sm font-semibold">Previous employer details</p>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => setEmployerDialog({ entry: null })}>
                        <Plus />
                        Add employer
                      </Button>
                    </div>
                    {employee.previousEmployers.length > 0 ? (
                      <ul className="divide-y">
                        {employee.previousEmployers.map((p) => (
                          <li key={p.id} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                            <div>
                              <p className="text-sm font-medium">{p.companyName}</p>
                              <p className="text-muted-foreground text-xs">
                                {p.designation ?? "—"} · {p.fromDate ? formatDate(p.fromDate) : "—"} –{" "}
                                {p.toDate ? formatDate(p.toDate) : "Present"}
                              </p>
                            </div>
                            <div className="flex shrink-0 gap-1">
                              <Button variant="ghost" size="icon" onClick={() => setEmployerDialog({ entry: p })}>
                                <Pencil />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => setEmployerToDelete(p)}>
                                <Trash2 />
                              </Button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <EmptyState size="sm" icon={Briefcase} title="No previous employers added yet" />
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="contact" className="mt-4 grid gap-4 sm:grid-cols-2">
                <Card>
                  <CardContent className="space-y-4 pt-6">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="text-muted-foreground size-4" />
                      <p className="text-sm font-semibold">Contact details</p>
                    </div>
                    <Field label="Personal email" value={employee.personalEmail} />
                    <p className="text-muted-foreground text-xs">
                      Update your personal email from the Personal tab&apos;s edit button.
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="space-y-4 pt-6">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <ShieldAlert className="text-muted-foreground size-4" />
                        <p className="text-sm font-semibold">
                          Emergency contact{employee.emergencyContacts.length > 1 ? "s" : ""}
                        </p>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => setContactDialog({ contact: null })}>
                        <Plus />
                        Add
                      </Button>
                    </div>
                    {employee.emergencyContacts.length > 0 ? (
                      <div className="space-y-4">
                        {employee.emergencyContacts.map((contact, i) => (
                          <div
                            key={contact.id}
                            className={`flex items-start justify-between gap-3 ${i > 0 ? "border-t pt-4" : ""}`}
                          >
                            <div className="grid flex-1 gap-1">
                              <Field label="Name" value={contact.name} />
                              <Field label="Relation" value={contact.relationship} />
                              <Field label="Contact no." value={`${contact.isdCode ?? ""} ${contact.phone}`.trim()} />
                            </div>
                            <div className="flex shrink-0 gap-1">
                              <Button variant="ghost" size="icon" onClick={() => setContactDialog({ contact })}>
                                <Pencil />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => setContactToDelete(contact)}>
                                <Trash2 />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <EmptyState size="sm" icon={ShieldAlert} title="No emergency contact on file" />
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="bank" className="mt-4">
                <Card className="sm:max-w-md">
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
            {idOpen && (
              <IdentificationDialog employee={employee} onClose={() => setIdOpen(false)} onSaved={refetch} />
            )}
            {familyDetailOpen && (
              <FamilyDetailDialog employee={employee} onClose={() => setFamilyDetailOpen(false)} onSaved={refetch} />
            )}
            {familyMemberDialog && (
              <FamilyMemberDialog
                kind={familyMemberDialog.kind}
                member={familyMemberDialog.member}
                onClose={() => setFamilyMemberDialog(null)}
                onSaved={refetch}
              />
            )}
            <ConfirmDialog
              open={!!familyMemberToDelete}
              onOpenChange={(open) => !open && setFamilyMemberToDelete(null)}
              title={`Remove ${familyMemberToDelete?.name ?? ""}?`}
              variant="destructive"
              confirmLabel="Remove"
              onConfirm={async () => {
                if (!familyMemberToDelete) return;
                await removeMyFamilyMember(familyMemberToDelete.kind, familyMemberToDelete.id);
                toast.success("Removed");
                refetch();
              }}
            />
            {employerDialog && (
              <PreviousEmployerDialog
                entry={employerDialog.entry}
                onClose={() => setEmployerDialog(null)}
                onSaved={refetch}
              />
            )}
            <ConfirmDialog
              open={!!employerToDelete}
              onOpenChange={(open) => !open && setEmployerToDelete(null)}
              title={`Remove ${employerToDelete?.companyName ?? ""}?`}
              variant="destructive"
              confirmLabel="Remove"
              onConfirm={async () => {
                if (!employerToDelete) return;
                await removeMyPreviousEmployer(employerToDelete.id);
                toast.success("Removed");
                refetch();
              }}
            />
            {contactDialog && (
              <EmergencyContactDialog
                contact={contactDialog.contact}
                onClose={() => setContactDialog(null)}
                onSaved={refetch}
              />
            )}
            <ConfirmDialog
              open={!!contactToDelete}
              onOpenChange={(open) => !open && setContactToDelete(null)}
              title={`Remove ${contactToDelete?.name ?? ""}?`}
              variant="destructive"
              confirmLabel="Remove"
              onConfirm={async () => {
                if (!contactToDelete) return;
                await removeMyEmergencyContact(contactToDelete.id);
                toast.success("Removed");
                refetch();
              }}
            />
          </>
        )}
      </AsyncSection>
    </div>
  );
}
