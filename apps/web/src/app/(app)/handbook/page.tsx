"use client";

import * as React from "react";
import { toast } from "sonner";
import { BookOpen, Pencil } from "lucide-react";
import { useAuthenticatedUser } from "@/lib/auth-context";
import { useAsync } from "@/lib/use-async";
import { ApiError } from "@/lib/api-client";
import {
  getHandbookSections,
  updateHandbookSection,
  type HandbookSection,
} from "@/lib/api/handbook";
import { PageHeader } from "@/components/hrm/page-header";
import { AsyncSection } from "@/components/hrm/async-section";
import { EmptyState } from "@/components/hrm/empty-state";
import { CardSkeleton } from "@/components/hrm/loading-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";

function SectionEditor({
  section,
  onSaved,
  onCancel,
}: {
  section: HandbookSection;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = React.useState(section.title);
  const [body, setBody] = React.useState(section.body);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await updateHandbookSection(section.id, { title: title.trim(), body: body.trim() });
      toast.success("Section updated");
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save this section. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <div className="space-y-2">
          <Label htmlFor={`handbook-title-${section.id}`}>Section title</Label>
          <Input
            id={`handbook-title-${section.id}`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`handbook-body-${section.id}`}>Content</Label>
          <Textarea
            id={`handbook-body-${section.id}`}
            rows={12}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !title.trim() || !body.trim()}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function HandbookPage() {
  const user = useAuthenticatedUser();
  const canEdit = user.role === "admin" || user.role === "hr";
  const { data, loading, error, refetch } = useAsync(getHandbookSections);
  const [editingId, setEditingId] = React.useState<string | null>(null);

  return (
    <div className="space-y-6">
      <PageHeader title="HR Handbook" description="Company policies every employee should know." />

      <AsyncSection
        loading={loading}
        error={error}
        onRetry={refetch}
        loadingFallback={
          <div className="space-y-3">
            <CardSkeleton lines={4} />
            <CardSkeleton lines={4} />
          </div>
        }
      >
        {(data ?? []).length === 0 ? (
          <EmptyState icon={BookOpen} title="Handbook content isn't set up yet" />
        ) : (
          <div className="space-y-4">
            {(data ?? []).map((section) =>
              editingId === section.id ? (
                <SectionEditor
                  key={section.id}
                  section={section}
                  onSaved={() => {
                    setEditingId(null);
                    refetch();
                  }}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <Card key={section.id}>
                  <CardHeader className="flex flex-row items-center justify-between gap-3">
                    <CardTitle>{section.title}</CardTitle>
                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Edit ${section.title}`}
                        onClick={() => setEditingId(section.id)}
                      >
                        <Pencil />
                      </Button>
                    )}
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm whitespace-pre-wrap">{section.body}</p>
                  </CardContent>
                </Card>
              ),
            )}
          </div>
        )}
      </AsyncSection>
    </div>
  );
}
