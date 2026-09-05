"use client";

import * as React from "react";
import { toast } from "sonner";
import { FileText, FolderOpen, Upload } from "lucide-react";
import { useAsync } from "@/lib/use-async";
import { getMyDocuments, submitDocument, type DocumentChecklistItem } from "@/lib/api/documents";
import { titleCase } from "@/lib/api/employees";
import { formatDate } from "@/lib/format";
import { ApiError } from "@/lib/api-client";
import { PageHeader } from "@/components/hrm/page-header";
import { StatusBadge } from "@/components/hrm/status-badge";
import { AsyncSection } from "@/components/hrm/async-section";
import { EmptyState } from "@/components/hrm/empty-state";
import { TableSkeleton } from "@/components/hrm/loading-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

export default function DocumentsPage() {
  const { data, loading, error, refetch } = useAsync(getMyDocuments);
  const [target, setTarget] = React.useState<DocumentChecklistItem | null>(null);
  const [draftUrl, setDraftUrl] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  function openSubmit(doc: DocumentChecklistItem) {
    setTarget(doc);
    setDraftUrl(doc.fileUrl ?? "");
    setSaveError(null);
  }

  async function handleSubmit() {
    if (!target) return;
    setSaving(true);
    setSaveError(null);
    try {
      await submitDocument(target.documentTypeId, draftUrl.trim());
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
                <DialogDescription>
                  There&apos;s no file storage yet, so paste a link to your already-uploaded document (Google
                  Drive, Dropbox, etc.) instead of attaching a file.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {saveError && (
                  <Alert variant="destructive">
                    <AlertDescription>{saveError}</AlertDescription>
                  </Alert>
                )}
                <div className="space-y-2">
                  <Label htmlFor="doc-url">Document URL</Label>
                  <Input
                    id="doc-url"
                    type="url"
                    placeholder="https://…"
                    value={draftUrl}
                    onChange={(e) => setDraftUrl(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setTarget(null)} disabled={saving}>
                  Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={saving || !draftUrl.trim()}>
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
