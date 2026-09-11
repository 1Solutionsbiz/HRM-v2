"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import {
  ChevronLeft,
  Mail,
  Phone,
  MapPin,
  Cake,
  Landmark,
  ShieldAlert,
  FileText,
  ExternalLink,
  Check,
  X,
  FolderOpen,
  GraduationCap,
  Laptop,
  PackageOpen,
  CalendarDays,
  IdCard,
  Users,
  Briefcase,
  Contact as ContactIcon,
  Baby,
  HeartHandshake,
  BadgeCheck,
  NotebookPen,
  Pencil,
  ShieldOff,
  ShieldCheck,
} from "lucide-react";
import { useAsync } from "@/lib/use-async";
import { useAuthenticatedUser } from "@/lib/auth-context";
import { formatDate } from "@/lib/format";
import { ApiError } from "@/lib/api-client";
import {
  getEmployee,
  updateEmployeeDailyReportSettings,
  employeeFullName,
  employeeInitials,
  titleCase,
  formatBloodGroup,
  maskAccountNumber,
  type EmployeeDetail,
  type FamilyMemberKind,
} from "@/lib/api/employees";
import { setUserActiveStatus } from "@/lib/api/admin";
import { getEmployeeDocuments, decideDocument, type DocumentChecklistItem } from "@/lib/api/documents";
import { getEmployeeLeaveBalances } from "@/lib/api/leave";
import { formatDailyReportTemplate, type DailyReportTemplate } from "@/lib/api/daily-reports";
import { LeaveLedgerSheet } from "@/components/hrm/leave-ledger-sheet";
import { StatusBadge } from "@/components/hrm/status-badge";
import { AsyncSection } from "@/components/hrm/async-section";
import { EmptyState } from "@/components/hrm/empty-state";
import { ConfirmDialog } from "@/components/hrm/confirm-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

function formatDateOrDash(iso: string | null | undefined): string {
  return iso ? formatDate(iso) : "—";
}

function Field({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="text-muted-foreground mt-0.5 size-4 shrink-0" />
      <div className="min-w-0">
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className="truncate text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}

const FAMILY_MEMBER_KIND_LABELS: Record<FamilyMemberKind, string> = {
  CHILD: "Children",
  OTHER_DEPENDENT: "Other dependents",
  NOMINEE: "Nominees",
};

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="text-sm font-medium">{value || "—"}</p>
    </div>
  );
}

function HeaderSkeleton() {
  return (
    <Card>
      <CardContent className="flex flex-col gap-6 pt-6 sm:flex-row">
        <Skeleton className="size-20 shrink-0 rounded-full" />
        <div className="flex-1 space-y-3">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-4 w-40" />
        </div>
      </CardContent>
    </Card>
  );
}

const DAILY_REPORT_TEMPLATE_VALUES: DailyReportTemplate[] = [
  "DEVELOPMENT",
  "SEO",
  "SOCIAL_MEDIA",
  "SALES",
  "HR",
  "GENERAL",
];
const NO_TEMPLATE_OVERRIDE = "NONE";

/** Employee override -> Designation default -> GENERAL, same hierarchy DailyReportsService.computeReport resolves at read time - this dialog is just a UI for the two pieces that feed it. */
function DailyReportSettingsDialog({
  employee,
  onClose,
  onSaved,
}: {
  employee: EmployeeDetail;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [override, setOverride] = React.useState(employee.dailyReportTemplateOverride ?? NO_TEMPLATE_OVERRIDE);
  const [exempt, setExempt] = React.useState(employee.dailyReportExempt);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const designationDefault = formatDailyReportTemplate(employee.designation?.dailyReportTemplate ?? "GENERAL");

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await updateEmployeeDailyReportSettings(employee.id, {
        dailyReportTemplateOverride: override === NO_TEMPLATE_OVERRIDE ? null : (override as DailyReportTemplate),
        dailyReportExempt: exempt,
      });
      toast.success("Daily Report settings updated");
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save these changes. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Daily Report settings</DialogTitle>
          <DialogDescription>{employeeFullName(employee)}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label>Template override</Label>
            <Select value={override} onValueChange={setOverride}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_TEMPLATE_OVERRIDE}>Use designation default ({designationDefault})</SelectItem>
                {DAILY_REPORT_TEMPLATE_VALUES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {formatDailyReportTemplate(t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-3">
            <Switch id="dr-exempt" checked={exempt} onCheckedChange={setExempt} />
            <Label htmlFor="dr-exempt">Exempt from Daily Work Reporting</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function EmployeeDetailPage() {
  const params = useParams<{ id: string }>();
  const currentUser = useAuthenticatedUser();
  const canManageAccess = currentUser.role === "admin";
  const { data: employee, loading, error, refetch } = useAsync(
    () => getEmployee(params.id),
    [params.id],
  );
  const {
    data: documents,
    loading: docsLoading,
    error: docsError,
    refetch: refetchDocs,
  } = useAsync(() => getEmployeeDocuments(params.id), [params.id]);
  const {
    data: leaveBalances,
    loading: leaveLoading,
    error: leaveError,
    refetch: refetchLeave,
  } = useAsync(() => getEmployeeLeaveBalances(params.id), [params.id]);

  const [deciding, setDeciding] = React.useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = React.useState<DocumentChecklistItem | null>(null);
  const [ledgerLeaveTypeId, setLedgerLeaveTypeId] = React.useState<string | null>(null);
  const [rejectNotes, setRejectNotes] = React.useState("");
  const [rejectError, setRejectError] = React.useState<string | null>(null);
  const [rejectSaving, setRejectSaving] = React.useState(false);
  const [editingDailyReport, setEditingDailyReport] = React.useState(false);
  const [deactivateOpen, setDeactivateOpen] = React.useState(false);
  const [accessSaving, setAccessSaving] = React.useState(false);

  async function handleDeactivate() {
    if (!employee) return;
    try {
      await setUserActiveStatus(employee.user.id, false);
      toast.success(`${employeeFullName(employee)}'s access has been deactivated`);
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't deactivate access.");
    }
  }

  async function handleReactivate() {
    if (!employee) return;
    setAccessSaving(true);
    try {
      await setUserActiveStatus(employee.user.id, true);
      toast.success(`${employeeFullName(employee)}'s access has been restored`);
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't restore access.");
    } finally {
      setAccessSaving(false);
    }
  }

  async function handleVerify(doc: DocumentChecklistItem) {
    setDeciding(doc.documentTypeId);
    try {
      await decideDocument(params.id, doc.documentTypeId, "VERIFIED");
      toast.success(`${doc.name} verified`);
      refetchDocs();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't verify this document.");
    } finally {
      setDeciding(null);
    }
  }

  function openReject(doc: DocumentChecklistItem) {
    setRejectTarget(doc);
    setRejectNotes("");
    setRejectError(null);
  }

  async function handleRejectConfirm() {
    if (!rejectTarget) return;
    setRejectSaving(true);
    setRejectError(null);
    try {
      await decideDocument(params.id, rejectTarget.documentTypeId, "REJECTED", rejectNotes.trim());
      toast.success(`${rejectTarget.name} rejected`);
      setRejectTarget(null);
      refetchDocs();
    } catch (err) {
      setRejectError(err instanceof ApiError ? err.message : "Couldn't reject this document.");
    } finally {
      setRejectSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="text-muted-foreground -ml-2.5 mb-2">
          <Link href="/people/employees">
            <ChevronLeft />
            Employees
          </Link>
        </Button>
      </div>

      <AsyncSection
        loading={loading}
        error={error}
        onRetry={refetch}
        loadingFallback={<HeaderSkeleton />}
      >
        {!employee ? (
          <Card>
            <CardContent className="pt-6">
              <EmptyState title="Employee not found" description="This employee may have been removed from the directory." />
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardContent className="flex flex-col gap-6 pt-6 sm:flex-row sm:items-start">
                <Avatar className="size-20 shrink-0 text-lg">
                  {employee.avatarUrl && <AvatarImage src={employee.avatarUrl} alt="" />}
                  <AvatarFallback className="text-xl">{employeeInitials(employee)}</AvatarFallback>
                </Avatar>

                <div className="min-w-0 flex-1 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-xl font-semibold tracking-tight">{employeeFullName(employee)}</h1>
                    {employee.designation && <Badge variant="outline">{employee.designation.title}</Badge>}
                    <StatusBadge status={titleCase(employee.status)} />
                    {!employee.user.isActive && <Badge variant="destructive">Login access disabled</Badge>}
                  </div>
                  <p className="text-muted-foreground text-sm">
                    {employee.designation?.title ?? "No designation"} · {employee.department?.name ?? "No department"}
                  </p>
                  <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
                    <span>
                      <span className="text-muted-foreground">Employee ID </span>
                      <span className="font-medium">{employee.employeeCode}</span>
                    </span>
                    <span>
                      <span className="text-muted-foreground">Joined </span>
                      <span className="font-medium">{formatDateOrDash(employee.dateOfJoining)}</span>
                    </span>
                  </div>
                  {canManageAccess && (
                    <div>
                      {employee.user.isActive ? (
                        <Button
                          size="sm"
                          onClick={() => setDeactivateOpen(true)}
                          className="bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/40"
                        >
                          <ShieldOff />
                          Deactivate access
                        </Button>
                      ) : (
                        <Button variant="outline" size="sm" onClick={handleReactivate} disabled={accessSaving}>
                          <ShieldCheck />
                          {accessSaving ? "Restoring…" : "Reactivate access"}
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                <div className="grid w-full shrink-0 grid-cols-2 gap-4 border-t pt-4 sm:w-auto sm:min-w-72 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-6">
                  <Field icon={Phone} label="Phone" value={employee.phone ?? "—"} />
                  <Field icon={Mail} label="Work email" value={employee.user.email} />
                  <Field icon={Cake} label="Date of birth" value={formatDateOrDash(employee.dateOfBirth)} />
                  <Field
                    icon={MapPin}
                    label="Reports to"
                    value={employee.manager ? employeeFullName(employee.manager) : "No manager"}
                  />
                </div>
              </CardContent>
            </Card>

            <Tabs defaultValue="personal">
              <TabsList>
                <TabsTrigger value="personal">Personal</TabsTrigger>
                <TabsTrigger value="employment">Employment</TabsTrigger>
                <TabsTrigger value="identification">Identification</TabsTrigger>
                <TabsTrigger value="family">Family</TabsTrigger>
                <TabsTrigger value="previous-employer">Previous employer</TabsTrigger>
                <TabsTrigger value="contact">Contact</TabsTrigger>
                <TabsTrigger value="documents">Documents</TabsTrigger>
                <TabsTrigger value="bank">Bank</TabsTrigger>
                <TabsTrigger value="leave">Leave</TabsTrigger>
                <TabsTrigger value="assets">Assets</TabsTrigger>
              </TabsList>

              <TabsContent value="personal" className="mt-4 space-y-4">
                <Card>
                  <CardContent className="grid gap-4 pt-6 sm:grid-cols-2">
                    <InfoRow label="Full name" value={employeeFullName(employee)} />
                    <InfoRow label="Personal email" value={employee.personalEmail} />
                    <InfoRow label="Phone" value={employee.phone} />
                    <InfoRow label="Date of birth" value={formatDateOrDash(employee.dateOfBirth)} />
                    <InfoRow label="Current address" value={employee.currentAddress} />
                    <InfoRow label="Permanent address" value={employee.permanentAddress} />
                    <InfoRow label="Gender" value={employee.gender ? titleCase(employee.gender) : null} />
                    <InfoRow label="Nationality" value={employee.nationality} />
                    <InfoRow label="Religion" value={employee.religion} />
                    <InfoRow
                      label="Marital status"
                      value={employee.maritalStatus ? titleCase(employee.maritalStatus) : null}
                    />
                    <InfoRow label="Blood group" value={formatBloodGroup(employee.bloodGroup)} />
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="mb-4 flex items-center gap-2">
                      <GraduationCap className="text-muted-foreground size-4" />
                      <p className="text-sm font-semibold">Education</p>
                    </div>
                    {employee.education.length === 0 ? (
                      <EmptyState size="sm" icon={GraduationCap} title="No education on file" />
                    ) : (
                      <ul className="divide-y">
                        {employee.education.map((edu) => (
                          <li key={edu.id} className="py-3 first:pt-0 last:pb-0">
                            <p className="text-sm font-medium">{edu.institution}</p>
                            <p className="text-muted-foreground text-xs">
                              {edu.fieldOfStudy ?? "—"} · {formatDateOrDash(edu.startDate)} –{" "}
                              {edu.endDate ? formatDate(edu.endDate) : "Present"}
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="employment" className="mt-4 space-y-4">
                <Card>
                  <CardContent className="grid gap-4 pt-6 sm:grid-cols-2">
                    <InfoRow label="Employee code" value={employee.employeeCode} />
                    <InfoRow label="Status" value={<StatusBadge status={titleCase(employee.status)} />} />
                    <InfoRow label="Designation" value={employee.designation?.title} />
                    <InfoRow label="Department" value={employee.department?.name} />
                    <InfoRow
                      label="Reporting manager"
                      value={employee.manager ? employeeFullName(employee.manager) : "No manager"}
                    />
                    <InfoRow label="Date of joining" value={formatDateOrDash(employee.dateOfJoining)} />
                    <InfoRow label="Employment type" value={titleCase(employee.employmentType)} />
                    <InfoRow label="Work location" value={employee.workLocation} />
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="space-y-4 pt-6">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <NotebookPen className="text-muted-foreground size-4" />
                        <p className="text-sm font-semibold">Daily Report settings</p>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => setEditingDailyReport(true)}>
                        <Pencil />
                        Edit
                      </Button>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <InfoRow
                        label="Template"
                        value={
                          employee.dailyReportTemplateOverride
                            ? `${formatDailyReportTemplate(employee.dailyReportTemplateOverride)} (override)`
                            : `${formatDailyReportTemplate(employee.designation?.dailyReportTemplate ?? "GENERAL")} (designation default)`
                        }
                      />
                      <InfoRow label="Exempt from Daily Work Reporting" value={employee.dailyReportExempt ? "Yes" : "No"} />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="identification" className="mt-4">
                <Card>
                  <CardContent className="space-y-4 pt-6">
                    <div className="flex items-center gap-2">
                      <IdCard className="text-muted-foreground size-4" />
                      <p className="text-sm font-semibold">Identification details</p>
                    </div>
                    {employee.identification ? (
                      <div className="grid gap-4 sm:grid-cols-2">
                        <InfoRow label="PAN no." value={employee.identification.panNumber} />
                        <InfoRow label="Aadhaar no." value={employee.identification.aadhaarNumber} />
                        <InfoRow label="Passport no." value={employee.identification.passportNumber} />
                        <InfoRow
                          label="Passport expiry date"
                          value={formatDateOrDash(employee.identification.passportExpiryDate)}
                        />
                        <InfoRow label="Driving license no." value={employee.identification.drivingLicenseNumber} />
                        <InfoRow
                          label="Driving license expiry date"
                          value={formatDateOrDash(employee.identification.drivingLicenseExpiryDate)}
                        />
                      </div>
                    ) : (
                      <EmptyState size="sm" icon={IdCard} title="Not filled in by the employee yet" />
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="family" className="mt-4 space-y-4">
                <Card>
                  <CardContent className="space-y-4 pt-6">
                    <div className="flex items-center gap-2">
                      <Users className="text-muted-foreground size-4" />
                      <p className="text-sm font-semibold">Family details</p>
                    </div>
                    {employee.familyDetail ? (
                      <div className="grid gap-4 sm:grid-cols-2">
                        <InfoRow label="Father's name" value={employee.familyDetail.fatherName} />
                        <InfoRow
                          label="Father's date of birth"
                          value={formatDateOrDash(employee.familyDetail.fatherDateOfBirth)}
                        />
                        <InfoRow label="Mother's name" value={employee.familyDetail.motherName} />
                        <InfoRow
                          label="Mother's date of birth"
                          value={formatDateOrDash(employee.familyDetail.motherDateOfBirth)}
                        />
                        <InfoRow
                          label="Marital status"
                          value={employee.maritalStatus ? titleCase(employee.maritalStatus) : null}
                        />
                      </div>
                    ) : (
                      <EmptyState size="sm" icon={Users} title="Not filled in by the employee yet" />
                    )}
                  </CardContent>
                </Card>

                {(["CHILD", "OTHER_DEPENDENT", "NOMINEE"] as const).map((kind) => {
                  const members = employee.familyMembers.filter((m) => m.kind === kind);
                  const Icon = kind === "CHILD" ? Baby : kind === "NOMINEE" ? BadgeCheck : HeartHandshake;
                  return (
                    <Card key={kind}>
                      <CardContent className="space-y-4 pt-6">
                        <div className="flex items-center gap-2">
                          <Icon className="text-muted-foreground size-4" />
                          <p className="text-sm font-semibold">{FAMILY_MEMBER_KIND_LABELS[kind]}</p>
                        </div>
                        {members.length > 0 ? (
                          <ul className="divide-y">
                            {members.map((m) => (
                              <li key={m.id} className="grid gap-4 py-3 first:pt-0 last:pb-0 sm:grid-cols-2">
                                <InfoRow label="Name" value={m.name} />
                                <InfoRow label="Relationship" value={m.relationship} />
                                <InfoRow label="Date of birth" value={formatDateOrDash(m.dateOfBirth)} />
                                {kind === "NOMINEE" && (
                                  <InfoRow
                                    label="Share"
                                    value={m.sharePercentage != null ? `${m.sharePercentage}%` : null}
                                  />
                                )}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <EmptyState size="sm" icon={Icon} title="None on file" />
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </TabsContent>

              <TabsContent value="previous-employer" className="mt-4">
                <Card>
                  <CardContent className="space-y-4 pt-6">
                    <div className="flex items-center gap-2">
                      <Briefcase className="text-muted-foreground size-4" />
                      <p className="text-sm font-semibold">Previous employer details</p>
                    </div>
                    {employee.previousEmployers.length > 0 ? (
                      <ul className="divide-y">
                        {employee.previousEmployers.map((p) => (
                          <li key={p.id} className="py-3 first:pt-0 last:pb-0">
                            <p className="text-sm font-medium">{p.companyName}</p>
                            <p className="text-muted-foreground text-xs">
                              {p.designation ?? "—"} · {formatDateOrDash(p.fromDate)} –{" "}
                              {p.toDate ? formatDate(p.toDate) : "Present"}
                            </p>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <EmptyState size="sm" icon={Briefcase} title="No previous employers on file" />
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="contact" className="mt-4 grid gap-4 sm:grid-cols-2">
                <Card>
                  <CardContent className="space-y-4 pt-6">
                    <div className="flex items-center gap-2">
                      <ContactIcon className="text-muted-foreground size-4" />
                      <p className="text-sm font-semibold">Contact details</p>
                    </div>
                    <InfoRow label="Personal email" value={employee.personalEmail} />
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="space-y-4 pt-6">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="text-muted-foreground size-4" />
                      <p className="text-sm font-semibold">
                        Emergency contact{employee.emergencyContacts.length > 1 ? "s" : ""}
                      </p>
                    </div>
                    {employee.emergencyContacts.length > 0 ? (
                      <div className="space-y-4">
                        {employee.emergencyContacts.map((contact, i) => (
                          <div key={contact.id} className={i > 0 ? "border-t pt-4" : undefined}>
                            <div className="grid gap-4">
                              <InfoRow label="Name" value={contact.name} />
                              <InfoRow label="Relation" value={contact.relationship} />
                              <InfoRow
                                label="Contact no."
                                value={contact.phone ? `${contact.isdCode ?? ""} ${contact.phone}`.trim() : null}
                              />
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

              <TabsContent value="documents" className="mt-4">
                <Card>
                  <CardContent className="pt-6">
                    <AsyncSection
                      loading={docsLoading}
                      error={docsError}
                      onRetry={refetchDocs}
                      loadingFallback={<Skeleton className="h-40 w-full" />}
                    >
                      {(documents ?? []).length === 0 ? (
                        <EmptyState icon={FolderOpen} title="No documents on file" />
                      ) : (
                        <ul className="divide-y">
                          {(documents ?? []).map((doc) => (
                            <li key={doc.documentTypeId} className="flex items-center justify-between gap-3 py-3">
                              <div className="flex min-w-0 items-center gap-3">
                                <FileText className="text-muted-foreground size-4 shrink-0" />
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-medium">{doc.name}</p>
                                  <p className="text-muted-foreground text-xs">
                                    {titleCase(doc.category)}
                                    {doc.uploadedAt ? ` · Uploaded ${formatDate(doc.uploadedAt)}` : ""}
                                    {doc.status === "REJECTED" && doc.notes ? ` · ${doc.notes}` : ""}
                                  </p>
                                </div>
                              </div>
                              <div className="flex shrink-0 items-center gap-2">
                                <StatusBadge status={titleCase(doc.status)} />
                                {doc.fileUrl && (
                                  <Button size="sm" variant="ghost" asChild>
                                    <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
                                      <ExternalLink />
                                      View
                                    </a>
                                  </Button>
                                )}
                                {doc.status === "PENDING_REVIEW" && (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      disabled={deciding === doc.documentTypeId}
                                      onClick={() => handleVerify(doc)}
                                    >
                                      <Check />
                                      Verify
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      disabled={deciding === doc.documentTypeId}
                                      onClick={() => openReject(doc)}
                                    >
                                      <X />
                                      Reject
                                    </Button>
                                  </>
                                )}
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </AsyncSection>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="bank" className="mt-4">
                <Card className="sm:max-w-md">
                  <CardContent className="space-y-4 pt-6">
                    <div className="flex items-center gap-2">
                      <Landmark className="text-muted-foreground size-4" />
                      <p className="text-sm font-semibold">Bank details</p>
                    </div>
                    {employee.bankDetail ? (
                      <div className="grid gap-4">
                        <InfoRow label="Bank" value={employee.bankDetail.bankName} />
                        <InfoRow label="Account number" value={maskAccountNumber(employee.bankDetail.accountNumber)} />
                        <InfoRow label="IFSC code" value={employee.bankDetail.ifscCode} />
                        <InfoRow label="Branch" value={employee.bankDetail.branch} />
                        <InfoRow label="City" value={employee.bankDetail.city} />
                      </div>
                    ) : (
                      <EmptyState size="sm" icon={Landmark} title="No bank details on file" />
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="leave" className="mt-4">
                <Card>
                  <CardContent className="pt-6">
                    <AsyncSection
                      loading={leaveLoading}
                      error={leaveError}
                      onRetry={refetchLeave}
                      loadingFallback={<Skeleton className="h-32 w-full" />}
                    >
                      {(leaveBalances ?? []).length === 0 ? (
                        <EmptyState icon={CalendarDays} title="No leave types configured" />
                      ) : (
                        <div className="grid gap-4 sm:grid-cols-3">
                          {(leaveBalances ?? []).map((b) => {
                            const total = b.allocatedDays + b.carriedOverDays;
                            return (
                              <Card key={b.leaveTypeId}>
                                <CardContent className="space-y-2 pt-6">
                                  <button
                                    type="button"
                                    className="text-sm font-medium hover:underline"
                                    onClick={() => setLedgerLeaveTypeId(b.leaveTypeId)}
                                  >
                                    {b.leaveTypeName}
                                  </button>
                                  <p className="text-2xl font-semibold tabular-nums">
                                    {b.remainingDays}
                                    <span className="text-muted-foreground ml-1 text-sm font-normal">
                                      / {total} days left
                                    </span>
                                  </p>
                                  <Progress value={total > 0 ? (b.usedDays / total) * 100 : 0} />
                                </CardContent>
                              </Card>
                            );
                          })}
                        </div>
                      )}
                    </AsyncSection>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="assets" className="mt-4">
                <Card>
                  <CardContent className="pt-6">
                    {employee.assets.length === 0 ? (
                      <EmptyState icon={PackageOpen} title="No assets assigned" />
                    ) : (
                      <ul className="divide-y">
                        {employee.assets.map((asset) => (
                          <li key={asset.id} className="flex items-center justify-between gap-3 py-3">
                            <div className="flex min-w-0 items-center gap-3">
                              <Laptop className="text-muted-foreground size-4 shrink-0" />
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium">{asset.name}</p>
                                <p className="text-muted-foreground text-xs">{asset.assetTag}</p>
                              </div>
                            </div>
                            <div className="shrink-0 text-right">
                              <p className="text-xs">
                                <span className="text-muted-foreground">Issued </span>
                                {formatDateOrDash(asset.issuedDate)}
                              </p>
                              {asset.returnDate ? (
                                <p className="text-xs">
                                  <span className="text-muted-foreground">Returned </span>
                                  {formatDate(asset.returnDate)}
                                </p>
                              ) : (
                                <StatusBadge status="Active" className="mt-1" />
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </AsyncSection>

      {employee && editingDailyReport && (
        <DailyReportSettingsDialog
          employee={employee}
          onClose={() => setEditingDailyReport(false)}
          onSaved={refetch}
        />
      )}

      {employee && ledgerLeaveTypeId && (
        <LeaveLedgerSheet
          employeeId={params.id}
          employeeName={employeeFullName(employee)}
          employeeCode={employee.employeeCode}
          leaveTypeId={ledgerLeaveTypeId}
          onOpenChange={(open) => !open && setLedgerLeaveTypeId(null)}
        />
      )}

      <Dialog open={!!rejectTarget} onOpenChange={(open) => !open && setRejectTarget(null)}>
        <DialogContent>
          {rejectTarget && (
            <>
              <DialogHeader>
                <DialogTitle>Reject {rejectTarget.name}</DialogTitle>
                <DialogDescription>
                  Let the employee know what needs to be fixed before resubmitting.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {rejectError && (
                  <Alert variant="destructive">
                    <AlertDescription>{rejectError}</AlertDescription>
                  </Alert>
                )}
                <div className="space-y-2">
                  <Label htmlFor="reject-notes">Reason (optional)</Label>
                  <Textarea
                    id="reject-notes"
                    placeholder="e.g. Document is illegible, wrong file uploaded…"
                    value={rejectNotes}
                    onChange={(e) => setRejectNotes(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setRejectTarget(null)} disabled={rejectSaving}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={handleRejectConfirm} disabled={rejectSaving}>
                  {rejectSaving ? "Rejecting…" : "Reject document"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deactivateOpen}
        onOpenChange={setDeactivateOpen}
        title="Deactivate this person's access?"
        description={
          employee
            ? `${employeeFullName(employee)} will be signed out of every device immediately and won't be able to log back in until access is restored. This doesn't change their employee record or status.`
            : ""
        }
        confirmLabel="Deactivate access"
        variant="destructive"
        confirmClassName="bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/40"
        onConfirm={handleDeactivate}
      />
    </div>
  );
}
