"use client";

import * as React from "react";
import { toast } from "sonner";
import { FileText, FolderOpen, Loader2, Paperclip, Upload, X } from "lucide-react";
import { useAsync } from "@/lib/use-async";
import {
  getMyDocuments,
  submitDocument,
  uploadDocumentFile,
  type DocumentChecklistItem,
} from "@/lib/api/documents";
import { titleCase } from "@/lib/api/employees";
import { formatDate } from "@/lib/format";
import { ApiError } from "@/lib/api-client";
import { PageHeader } from "@/components/hrm/page-header";
import { StatusBadge } from "@/components/hrm/status-badge";
import { AsyncSection } from "@/components/hrm/async-section";
import { EmptyState } from "@/components/hrm/empty-state";
import { TableSkeleton } from "@/components/hrm/loading-state";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

const ALLOWED_DOCUMENT_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

export default function DocumentsPage() {
  const { data, loading, error, refetch } = useAsync(getMyDocuments);
  const [target, setTarget] = React.useState<DocumentChecklistItem | null>(null);
  const [fileUrl, setFileUrl] = React.useState<string | null>(null);
  const [fileName, setFileName] = React.useState<string | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [fileError, setFileError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  function openSubmit(doc: DocumentChecklistItem) {
    setTarget(doc);
    setFileUrl(null);
    setFileName(null);
    setFileError(null);
    setSaveError(null);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file after removing it
    if (!file) return;
    setFileError(null);
    if (!ALLOWED_DOCUMENT_TYPES.includes(file.type)) {
      setFileError("Documents must be a JPEG, PNG, WEBP, or PDF file.");
      return;
    }
    if (file.size > MAX_DOCUMENT_BYTES) {
      setFileError("Document must be smaller than 10 MB.");
      return;
    }
    setUploading(true);
    try {
      const result = await uploadDocumentFile(file);
      setFileUrl(result.url);
      setFileName(file.name);
    } catch (err) {
      setFileError(err instanceof ApiError ? err.message : "Couldn't upload this file. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  function removeFile() {
    setFileUrl(null);
    setFileName(null);
    setFileError(null);
  }

  async function handleSubmit() {
    if (!target || !fileUrl) return;
    setSaving(true);
    setSaveError(null);
    try {
      await submitDocument(target.documentTypeId, fileUrl);
      toast.success(`${target.name} submitted`, {
        description: "It's now pending review.",
      });
      setTarget(null);
      refetch();
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : "Couldn't submit this document. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const missing = (data ?? []).filter((d) => d.status === "MISSING");

  return (
    <div className="space-y-6">
      <PageHeader title="Documents" description="Your identity, education, and employment documents." />

      {missing.length > 0 && (
        <div className="border-warning/30 bg-warning/5 flex items-center justify-between gap-3 rounded-lg border px-4 py-3">
          <p className="text-sm">
            <span className="font-medium">{missing.length} document{missing.length > 1 ? "s" : ""}</span>{" "}
            still need to be uploaded.
          </p>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All documents</CardTitle>
        </CardHeader>
        <CardContent>
          <AsyncSection
            loading={loading}
            error={error}
            onRetry={refetch}
            loadingFallback={<TableSkeleton rows={5} columns={3} />}
          >
            {(data ?? []).length === 0 ? (
              <EmptyState icon={FolderOpen} title="No documents on file" />
            ) : (
              <ul className="divide-y">
                {(data ?? []).map((doc) => (
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
                      {doc.status === "MISSING" ? (
                        <Button size="sm" variant="outline" onClick={() => openSubmit(doc)}>
                          <Upload />
                          Upload
                        </Button>
                      ) : doc.status !== "VERIFIED" ? (
                        <Button size="sm" variant="ghost" onClick={() => openSubmit(doc)}>
                          Replace
                        </Button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </AsyncSection>
        </CardContent>
      </Card>

      <Dialog open={!!target} onOpenChange={(open) => !open && setTarget(null)}>
        <DialogContent>
          {target && (
            <>
              <DialogHeader>
                <DialogTitle>Submit {target.name}</DialogTitle>
                <DialogDescription>Attach a photo or scan of this document.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {saveError && (
                  <Alert variant="destructive">
                    <AlertDescription>{saveError}</AlertDescription>
                  </Alert>
                )}
                <div className="space-y-2">
                  {fileName ? (
                    <div className="border-input flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                      <FileText className="text-muted-foreground size-4 shrink-0" />
                      <span className="min-w-0 flex-1 truncate">{fileName}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Remove file"
                        onClick={removeFile}
                      >
                        <X className="size-4" />
                      </Button>
                    </div>
                  ) : (
                    <label
                      htmlFor="document-file"
                      className="border-input hover:bg-accent flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed px-3 py-3 text-sm"
                    >
                      {uploading ? (
                        <>
                          <Loader2 className="size-4 animate-spin" />
                          Uploading…
                        </>
                      ) : (
                        <>
                          <Paperclip className="text-muted-foreground size-4" />
                          Attach a file
                        </>
                      )}
                      <input
                        id="document-file"
                        type="file"
                        accept="image/jpeg,image/png,image/webp,application/pdf"
                        className="hidden"
                        disabled={uploading}
                        onChange={handleFileChange}
                      />
                    </label>
                  )}
                  {fileError ? (
                    <p className="text-destructive text-xs">{fileError}</p>
                  ) : (
                    <p className="text-muted-foreground text-xs">JPEG, PNG, WEBP, or PDF, up to 10 MB.</p>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setTarget(null)} disabled={saving}>
                  Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={saving || uploading || !fileUrl}>
                  {saving ? "Submitting…" : "Submit"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
