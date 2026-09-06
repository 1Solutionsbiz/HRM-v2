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
} from "lucide-react";
import { useAsync } from "@/lib/use-async";
import { formatDate } from "@/lib/format";
import { ApiError } from "@/lib/api-client";
import {
  getEmployee,
  employeeFullName,
  employeeInitials,
  titleCase,
  formatBloodGroup,
  maskAccountNumber,
} from "@/lib/api/employees";
import { getEmployeeDocuments, decideDocument, type DocumentChecklistItem } from "@/lib/api/documents";
import { StatusBadge } from "@/components/hrm/status-badge";
import { AsyncSection } from "@/components/hrm/async-section";
import { EmptyState } from "@/components/hrm/empty-state";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

export default function EmployeeDetailPage() {
  const params = useParams<{ id: string }>();
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

  const [deciding, setDeciding] = React.useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = React.useState<DocumentChecklistItem | null>(null);
  const [rejectNotes, setRejectNotes] = React.useState("");
  const [rejectError, setRejectError] = React.useState<string | null>(null);
  const [rejectSaving, setRejectSaving] = React.useState(false);

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
                <TabsTrigger value="documents">Documents</TabsTrigger>
                <TabsTrigger value="bank">Bank &amp; emergency</TabsTrigger>
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

              <TabsContent value="employment" className="mt-4">
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

              <TabsContent value="bank" className="mt-4 grid gap-4 sm:grid-cols-2">
                <Card>
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
                        <InfoRow label="PAN" value={employee.bankDetail.panNumber} />
                      </div>
                    ) : (
                      <EmptyState size="sm" icon={Landmark} title="No bank details on file" />
                    )}
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
                              <InfoRow label="Relationship" value={contact.relationship} />
                              <InfoRow label="Phone" value={contact.phone} />
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
    </div>
  );
}
