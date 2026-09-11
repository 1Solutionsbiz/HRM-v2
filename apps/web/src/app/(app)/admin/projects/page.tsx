"use client";

import * as React from "react";
import { toast } from "sonner";
import { Archive, ArchiveRestore, FolderKanban, Pencil, Plus, Trash2 } from "lucide-react";
import { useAsync } from "@/lib/use-async";
import { ApiError } from "@/lib/api-client";
import { getProjects, createProject, updateProject, deleteProject, type Project } from "@/lib/api/projects";
import { PageHeader } from "@/components/hrm/page-header";
import { AsyncSection } from "@/components/hrm/async-section";
import { EmptyState } from "@/components/hrm/empty-state";
import { ConfirmDialog } from "@/components/hrm/confirm-dialog";
import { TableSkeleton } from "@/components/hrm/loading-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export default function ProjectsPage() {
  const { data, loading, error, refetch } = useAsync(getProjects);
  const projects = data ?? [];

  const [target, setTarget] = React.useState<Project | "new" | null>(null);
  const [name, setName] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<Project | null>(null);

  function openAdd() {
    setName("");
    setSaveError(null);
    setTarget("new");
  }

  function openEdit(project: Project) {
    setName(project.name);
    setSaveError(null);
    setTarget(project);
  }

  async function handleSave() {
    const trimmed = name.trim();
    if (!target || !trimmed) return;
    setSaving(true);
    setSaveError(null);
    try {
      if (target === "new") {
        await createProject({ name: trimmed });
        toast.success(`${trimmed} added`);
      } else {
        await updateProject(target.id, { name: trimmed });
        toast.success(`${trimmed} updated`);
      }
      setTarget(null);
      refetch();
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : "Couldn't save this project. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteProject(deleteTarget.id);
      toast.success(`${deleteTarget.name} removed`);
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't remove this project.");
    }
  }

  async function toggleArchived(project: Project) {
    try {
      await updateProject(project.id, { isActive: !project.isActive });
      toast.success(project.isActive ? `${project.name} archived` : `${project.name} unarchived`);
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't update this project.");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects"
        description="The projects employees can tag their Daily Work Report tasks against."
        actions={
          <Button size="sm" onClick={openAdd}>
            <Plus />
            Add project
          </Button>
        }
      />

      <AsyncSection
        loading={loading}
        error={error}
        onRetry={refetch}
        loadingFallback={<TableSkeleton rows={6} columns={3} />}
      >
        {projects.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <EmptyState icon={FolderKanban} title="No projects added yet" />
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-0" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projects.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className={`font-medium ${!p.isActive ? "text-muted-foreground" : ""}`}>
                        {p.name}
                      </TableCell>
                      <TableCell>
                        {p.isActive ? (
                          <Badge variant="secondary">Active</Badge>
                        ) : (
                          <Badge variant="outline">Archived</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="icon-sm" variant="ghost" aria-label="Edit" onClick={() => openEdit(p)}>
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            aria-label={p.isActive ? "Archive" : "Unarchive"}
                            onClick={() => toggleArchived(p)}
                          >
                            {p.isActive ? <Archive className="size-3.5" /> : <ArchiveRestore className="size-3.5" />}
                          </Button>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            aria-label="Delete"
                            onClick={() => setDeleteTarget(p)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </AsyncSection>

      <Dialog open={!!target} onOpenChange={(open) => !open && setTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{target === "new" ? "Add project" : "Edit project"}</DialogTitle>
            <DialogDescription>Shown in the Daily Work Report task dropdown for every employee.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {saveError && (
              <Alert variant="destructive">
                <AlertDescription>{saveError}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="project-name">Name</Label>
              <Input
                id="project-name"
                placeholder="e.g. HRM"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || !name.trim()}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Remove this project?"
        description={
          deleteTarget
            ? `"${deleteTarget.name}" will be gone for good. Projects already referenced by an existing report can't be removed - archive it instead.`
            : ""
        }
        confirmLabel="Remove"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  );
}
