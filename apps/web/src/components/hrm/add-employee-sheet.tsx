"use client";

import * as React from "react";
import { toast } from "sonner";
import { Check, Copy } from "lucide-react";
import { ApiError } from "@/lib/api-client";
import { createEmployee, type CreateEmployeePayload, type EmploymentType } from "@/lib/api/employees";
import { getDepartments, getDesignations, type DepartmentRow, type DesignationRow } from "@/lib/api/admin";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const NONE = "__none__";

const EMPLOYMENT_TYPES: { value: EmploymentType; label: string }[] = [
  { value: "FULL_TIME", label: "Full-time" },
  { value: "PART_TIME", label: "Part-time" },
  { value: "CONTRACT", label: "Contract" },
  { value: "INTERN", label: "Intern" },
];

interface FormState {
  email: string;
  firstName: string;
  lastName: string;
  dateOfJoining: string;
  personalEmail: string;
  phone: string;
  dateOfBirth: string;
  employmentType: EmploymentType;
  workLocation: string;
  currentAddress: string;
  permanentAddress: string;
  departmentId: string;
  designationId: string;
  managerId: string;
}

const EMPTY_FORM: FormState = {
  email: "",
  firstName: "",
  lastName: "",
  dateOfJoining: "",
  personalEmail: "",
  phone: "",
  dateOfBirth: "",
  employmentType: "FULL_TIME",
  workLocation: "",
  currentAddress: "",
  permanentAddress: "",
  departmentId: NONE,
  designationId: NONE,
  managerId: NONE,
};

interface AddEmployeeSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Active employees, for the manager picker — the caller already has this list loaded. */
  managers: { id: string; firstName: string; lastName: string }[];
  onCreated: () => void;
}

export function AddEmployeeSheet({ open, onOpenChange, managers, onCreated }: AddEmployeeSheetProps) {
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM);
  const [departments, setDepartments] = React.useState<DepartmentRow[]>([]);
  const [designations, setDesignations] = React.useState<DesignationRow[]>([]);
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<{ name: string; email: string; temporaryPassword: string } | null>(
    null,
  );
  const [copied, setCopied] = React.useState(false);

  // Reset the form the moment `open` flips true — adjusting state during
  // render from a prop change, not inside an effect (see the React docs'
  // "storing information from previous renders" pattern), so this can't
  // trigger a setState-in-effect cascade.
  const [prevOpen, setPrevOpen] = React.useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setForm(EMPTY_FORM);
      setSaveError(null);
      setResult(null);
      setCopied(false);
    }
  }

  React.useEffect(() => {
    if (!open) return;
    Promise.all([getDepartments(), getDesignations()])
      .then(([d, t]) => {
        setDepartments(d);
        setDesignations(t);
      })
      .catch(() => {
        // Non-fatal — the form still works with department/designation left unset.
      });
  }, [open]);

  const designationsForDepartment = React.useMemo(
    () =>
      form.departmentId === NONE
        ? designations
        : designations.filter((d) => d.department.id === form.departmentId),
    [designations, form.departmentId],
  );

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const canSubmit =
    form.email.trim() && form.firstName.trim() && form.lastName.trim() && form.dateOfJoining.trim();

  async function handleSubmit() {
    if (!canSubmit) return;
    setSaving(true);
    setSaveError(null);
    try {
      const payload: CreateEmployeePayload = {
        email: form.email.trim(),
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        dateOfJoining: form.dateOfJoining,
        employmentType: form.employmentType,
      };
      if (form.personalEmail.trim()) payload.personalEmail = form.personalEmail.trim();
      if (form.phone.trim()) payload.phone = form.phone.trim();
      if (form.dateOfBirth.trim()) payload.dateOfBirth = form.dateOfBirth;
      if (form.workLocation.trim()) payload.workLocation = form.workLocation.trim();
      if (form.currentAddress.trim()) payload.currentAddress = form.currentAddress.trim();
      if (form.permanentAddress.trim()) payload.permanentAddress = form.permanentAddress.trim();
      if (form.departmentId !== NONE) payload.departmentId = form.departmentId;
      if (form.designationId !== NONE) payload.designationId = form.designationId;
      if (form.managerId !== NONE) payload.managerId = form.managerId;

      const created = await createEmployee(payload);
      toast.success(`${created.firstName} ${created.lastName} added`);
      setResult({
        name: `${created.firstName} ${created.lastName}`,
        email: created.user.email,
        temporaryPassword: created.temporaryPassword,
      });
      onCreated();
    } catch (err) {
      setSaveError(
        err instanceof ApiError ? err.message : "Couldn't add this employee. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  function copyPassword() {
    if (!result) return;
    navigator.clipboard.writeText(result.temporaryPassword).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        {result ? (
          <>
            <SheetHeader>
              <SheetTitle>{result.name} was added</SheetTitle>
              <SheetDescription>
                Share this temporary password with them — it&apos;s shown only once and no invite email is sent.
              </SheetDescription>
            </SheetHeader>
            <div className="space-y-4 px-4">
              <div className="space-y-2">
                <Label>Login email</Label>
                <Input readOnly value={result.email} />
              </div>
              <div className="space-y-2">
                <Label>Temporary password</Label>
                <div className="flex gap-2">
                  <Input readOnly value={result.temporaryPassword} className="font-mono" />
                  <Button type="button" variant="outline" size="icon" onClick={copyPassword} aria-label="Copy password">
                    {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                  </Button>
                </div>
              </div>
            </div>
            <SheetFooter>
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </SheetFooter>
          </>
        ) : (
          <>
            <SheetHeader>
              <SheetTitle>Add employee</SheetTitle>
              <SheetDescription>
                Creates their login and employee record. A temporary password is shown once you save.
              </SheetDescription>
            </SheetHeader>
            <div className="space-y-4 px-4">
              {saveError && (
                <Alert variant="destructive">
                  <AlertDescription>{saveError}</AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ae-first">First name *</Label>
                  <Input id="ae-first" value={form.firstName} onChange={(e) => set("firstName", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ae-last">Last name *</Label>
                  <Input id="ae-last" value={form.lastName} onChange={(e) => set("lastName", e.target.value)} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ae-email">Work email *</Label>
                <Input
                  id="ae-email"
                  type="email"
                  placeholder="used to log in"
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ae-doj">Date of joining *</Label>
                  <Input
                    id="ae-doj"
                    type="date"
                    value={form.dateOfJoining}
                    onChange={(e) => set("dateOfJoining", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ae-dob">Date of birth</Label>
                  <Input
                    id="ae-dob"
                    type="date"
                    value={form.dateOfBirth}
                    onChange={(e) => set("dateOfBirth", e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ae-phone">Phone</Label>
                  <Input id="ae-phone" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ae-personal-email">Personal email</Label>
                  <Input
                    id="ae-personal-email"
                    type="email"
                    value={form.personalEmail}
                    onChange={(e) => set("personalEmail", e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Employment type</Label>
                <Select value={form.employmentType} onValueChange={(v) => set("employmentType", v as EmploymentType)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EMPLOYMENT_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Department</Label>
                  <Select
                    value={form.departmentId}
                    onValueChange={(v) => {
                      set("departmentId", v);
                      set("designationId", NONE);
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Unassigned</SelectItem>
                      {departments.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Designation</Label>
                  <Select value={form.designationId} onValueChange={(v) => set("designationId", v)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Unassigned</SelectItem>
                      {designationsForDepartment.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Reporting manager</Label>
                <Select value={form.managerId} onValueChange={(v) => set("managerId", v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>None</SelectItem>
                    {managers.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.firstName} {m.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ae-work-location">Work location</Label>
                <Input
                  id="ae-work-location"
                  value={form.workLocation}
                  onChange={(e) => set("workLocation", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ae-current-address">Current address</Label>
                <Textarea
                  id="ae-current-address"
                  rows={2}
                  value={form.currentAddress}
                  onChange={(e) => set("currentAddress", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ae-permanent-address">Permanent address</Label>
                <Textarea
                  id="ae-permanent-address"
                  rows={2}
                  value={form.permanentAddress}
                  onChange={(e) => set("permanentAddress", e.target.value)}
                />
              </div>
            </div>
            <SheetFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={saving || !canSubmit}>
                {saving ? "Adding…" : "Add employee"}
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
