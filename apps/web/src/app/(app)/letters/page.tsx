"use client";

import * as React from "react";
import { toast } from "sonner";
import { Ban, Download, FileText, Search } from "lucide-react";
import { useAsync } from "@/lib/use-async";
import { ApiError } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import {
  cancelLetter,
  downloadLetter,
  generateLetter,
  getLetterCategories,
  listGeneratedLetters,
  previewLetter,
  searchLetterEmployees,
  type GeneratedLetter,
  type LetterEmployeeSummary,
  type LetterPreview,
  type LetterTypeSummary,
} from "@/lib/api/letters";
import { PageHeader } from "@/components/hrm/page-header";
import { AsyncSection } from "@/components/hrm/async-section";
import { EmptyState } from "@/components/hrm/empty-state";
import { TableSkeleton } from "@/components/hrm/loading-state";
import { StatusBadge } from "@/components/hrm/status-badge";
import { ConfirmDialog } from "@/components/hrm/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

/** Splits a snake_case custom-variable key into a readable label, e.g. "lastWorkingDay" -> "Last working day". */
function humanizeKey(key: string): string {
  const spaced = key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export default function LettersPage() {
  const categories = useAsync(getLetterCategories);
  const letters = useAsync(() => listGeneratedLetters());

  const [query, setQuery] = React.useState("");
  const [searching, setSearching] = React.useState(false);
  const [employeeResults, setEmployeeResults] = React.useState<LetterEmployeeSummary[]>([]);
  const [selectedEmployee, setSelectedEmployee] = React.useState<LetterEmployeeSummary | null>(null);

  const [selectedTypeId, setSelectedTypeId] = React.useState("");
  const [customValues, setCustomValues] = React.useState<Record<string, string>>({});

  const [preview, setPreview] = React.useState<LetterPreview | null>(null);
  const [previewing, setPreviewing] = React.useState(false);
  const [generating, setGenerating] = React.useState(false);

  const [cancelTarget, setCancelTarget] = React.useState<GeneratedLetter | null>(null);
  const [cancelReason, setCancelReason] = React.useState("");

  const allTypes: LetterTypeSummary[] = (categories.data ?? []).flatMap((c) => c.types);
  const selectedType = allTypes.find((t) => t.id === selectedTypeId) ?? null;

  async function handleSearch() {
    setSearching(true);
    try {
      setEmployeeResults(await searchLetterEmployees(query));
    } catch {
      toast.error("Couldn't search employees. Please try again.");
    } finally {
      setSearching(false);
    }
  }

  function selectEmployee(employee: LetterEmployeeSummary) {
    setSelectedEmployee(employee);
    setEmployeeResults([]);
    setPreview(null);
  }

  function selectType(typeId: string) {
    setSelectedTypeId(typeId);
    setCustomValues({});
    setPreview(null);
  }

  function canSubmit(): boolean {
    if (!selectedEmployee || !selectedType) return false;
    return selectedType.customVariableKeys.every((key) => customValues[key]?.trim());
  }

  async function handlePreview() {
    if (!selectedEmployee || !selectedType) return;
    setPreviewing(true);
    try {
      setPreview(
        await previewLetter({
          employeeId: selectedEmployee.id,
          letterTypeId: selectedType.id,
          customVariables: customValues,
        }),
      );
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't preview this letter.");
    } finally {
      setPreviewing(false);
    }
  }

  async function handleGenerate() {
    if (!selectedEmployee || !selectedType) return;
    setGenerating(true);
    try {
      const created = await generateLetter({
        employeeId: selectedEmployee.id,
        letterTypeId: selectedType.id,
        customVariables: customValues,
      });
      toast.success(`${selectedType.name} generated: ${created.documentNumber}`);
      setSelectedEmployee(null);
      setSelectedTypeId("");
      setCustomValues({});
      setPreview(null);
      setQuery("");
      letters.refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't generate this letter. Please try again.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleDownload(letter: GeneratedLetter) {
    try {
      await downloadLetter(letter.id, letter.documentNumber);
    } catch {
      toast.error("Couldn't download this letter. Please try again.");
    }
  }

  async function handleCancel() {
    if (!cancelTarget) return;
    try {
      await cancelLetter(cancelTarget.id, cancelReason.trim());
      toast.success(`${cancelTarget.documentNumber} cancelled`);
      setCancelReason("");
      letters.refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't cancel this letter.");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Letters" description="Generate and manage employee HR letters." />

      <Card>
        <CardHeader>
          <CardTitle>Generate a letter</CardTitle>
          <CardDescription>Search for an employee, choose a letter type, and fill in the required details.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label>Employee</Label>
            {selectedEmployee ? (
              <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <span>
                  {selectedEmployee.firstName} {selectedEmployee.lastName} ({selectedEmployee.employeeCode})
                  {selectedEmployee.designation ? ` — ${selectedEmployee.designation.title}` : ""}
                </span>
                <Button variant="ghost" size="sm" onClick={() => setSelectedEmployee(null)}>
                  Change
                </Button>
              </div>
            ) : (
              <>
                <div className="flex gap-2">
                  <Input
                    placeholder="Search by name or employee code…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  />
                  <Button type="button" variant="outline" onClick={handleSearch} disabled={searching}>
                    <Search className="size-4" />
                  </Button>
                </div>
                {employeeResults.length > 0 && (
                  <div className="max-h-56 overflow-y-auto rounded-md border">
                    {employeeResults.map((employee) => (
                      <button
                        key={employee.id}
                        type="button"
                        className="hover:bg-muted flex w-full items-center justify-between border-b px-3 py-2 text-left text-sm last:border-b-0"
                        onClick={() => selectEmployee(employee)}
                      >
                        <span>
                          {employee.firstName} {employee.lastName} ({employee.employeeCode})
                        </span>
                        <span className="text-muted-foreground text-xs">{employee.department?.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="space-y-2">
            <Label>Letter type</Label>
            <Select value={selectedTypeId} onValueChange={selectType}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a letter type" />
              </SelectTrigger>
              <SelectContent>
                {(categories.data ?? []).map((category) => (
                  <React.Fragment key={category.id}>
                    {category.types.map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </React.Fragment>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedType && selectedType.customVariableKeys.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2">
              {selectedType.customVariableKeys.map((key) => (
                <div key={key} className="space-y-2">
                  <Label htmlFor={`custom-${key}`}>{humanizeKey(key)} *</Label>
                  <Input
                    id={`custom-${key}`}
                    value={customValues[key] ?? ""}
                    onChange={(e) => setCustomValues((prev) => ({ ...prev, [key]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
          )}

          {preview && (
            <div className="bg-muted/40 space-y-3 rounded-md border p-4 text-sm">
              <p className="font-medium">{preview.letterTypeName} — preview</p>
              {preview.paragraphs.map((p, i) => (
                <p key={i} className="text-muted-foreground whitespace-pre-line">
                  {p}
                </p>
              ))}
              <p className="pt-2 font-medium">{preview.signatoryName}</p>
              <p className="text-muted-foreground text-xs">{preview.signatoryTitle}</p>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={!canSubmit() || previewing} onClick={handlePreview}>
              {previewing ? "Loading preview…" : "Preview"}
            </Button>
            <Button type="button" disabled={!canSubmit() || generating} onClick={handleGenerate}>
              {generating ? "Generating…" : "Generate letter"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Generated letters</CardTitle>
        </CardHeader>
        <CardContent>
          <AsyncSection loading={letters.loading} error={letters.error} onRetry={letters.refetch} loadingFallback={<TableSkeleton rows={5} />}>
            {(letters.data ?? []).length === 0 ? (
              <EmptyState icon={FileText} title="No letters generated yet" description="Letters you generate will appear here." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Document No.</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Employee</TableHead>
                    <TableHead>Generated</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(letters.data ?? []).map((letter) => (
                    <TableRow key={letter.id}>
                      <TableCell className="font-mono text-xs">{letter.documentNumber}</TableCell>
                      <TableCell>{letter.letterType?.name}</TableCell>
                      <TableCell>
                        {letter.employee ? `${letter.employee.firstName} ${letter.employee.lastName}` : "—"}
                      </TableCell>
                      <TableCell>{formatDate(letter.generatedAt)}</TableCell>
                      <TableCell>
                        <StatusBadge status={letter.status} />
                      </TableCell>
                      <TableCell className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleDownload(letter)} title="Download">
                          <Download className="size-4" />
                        </Button>
                        {letter.status === "GENERATED" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive"
                            onClick={() => setCancelTarget(letter)}
                            title="Cancel"
                          >
                            <Ban className="size-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </AsyncSection>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!cancelTarget}
        onOpenChange={(open) => {
          if (!open) {
            setCancelTarget(null);
            setCancelReason("");
          }
        }}
        title={`Cancel ${cancelTarget?.documentNumber}?`}
        description="This marks the letter as cancelled. It stays in the history for the record."
        confirmLabel="Cancel letter"
        variant="destructive"
        confirmDisabled={!cancelReason.trim()}
        onConfirm={handleCancel}
      >
        <Textarea
          placeholder="Reason for cancelling (required)"
          value={cancelReason}
          onChange={(e) => setCancelReason(e.target.value)}
        />
      </ConfirmDialog>
    </div>
  );
}
