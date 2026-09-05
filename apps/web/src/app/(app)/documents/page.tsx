"use client";

import * as React from "react";
import { toast } from "sonner";
import { FileText, FolderOpen, Upload } from "lucide-react";
import { useAsync } from "@/lib/use-async";
import { getDocuments } from "@/lib/mock/mock-api";
import { formatDate } from "@/lib/format";
import { PageHeader } from "@/components/hrm/page-header";
import { StatusBadge } from "@/components/hrm/status-badge";
import { AsyncSection } from "@/components/hrm/async-section";
import { EmptyState } from "@/components/hrm/empty-state";
import { TableSkeleton } from "@/components/hrm/loading-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DocumentsPage() {
  const { data, loading, error, refetch } = useAsync(getDocuments);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [uploadTargetId, setUploadTargetId] = React.useState<string | null>(null);

  function triggerUpload(id: string) {
    setUploadTargetId(id);
    fileInputRef.current?.click();
  }

  function handleFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !uploadTargetId) return;
    toast.success(`${file.name} uploaded`, {
      description: "This is a UI preview - it will show as \"Pending review\" once the backend exists.",
    });
  }

  const missing = (data ?? []).filter((d) => d.status === "Missing");

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
                  <li key={doc.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <FileText className="text-muted-foreground size-4 shrink-0" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{doc.name}</p>
                        <p className="text-muted-foreground text-xs">
                          {doc.category}
                          {doc.uploadedOn ? ` · Uploaded ${formatDate(doc.uploadedOn)}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <StatusBadge status={doc.status} />
                      {doc.status === "Missing" ? (
                        <Button size="sm" variant="outline" onClick={() => triggerUpload(doc.id)}>
                          <Upload />
                          Upload
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => triggerUpload(doc.id)}
                        >
                          Replace
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </AsyncSection>
        </CardContent>
      </Card>

      <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChosen} />
    </div>
  );
}
