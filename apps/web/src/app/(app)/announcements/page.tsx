"use client";

import * as React from "react";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ImagePlus, Loader2, Megaphone, Pencil, Plus, X } from "lucide-react";
import { useAuthenticatedUser } from "@/lib/auth-context";
import { useAsync } from "@/lib/use-async";
import { ApiError } from "@/lib/api-client";
import {
  getAnnouncements,
  markAnnouncementRead,
  publishAnnouncement,
  updateAnnouncement,
  uploadAnnouncementImage,
  type Announcement,
  type AnnouncementCategory,
} from "@/lib/api/announcements";
import { formatDate } from "@/lib/format";
import { titleCase } from "@/lib/api/employees";
import { PageHeader } from "@/components/hrm/page-header";
import { AsyncSection } from "@/components/hrm/async-section";
import { EmptyState } from "@/components/hrm/empty-state";
import { CardSkeleton } from "@/components/hrm/loading-state";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
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

const categoryTone: Record<AnnouncementCategory, "default" | "secondary" | "outline"> = {
  HOLIDAY: "default",
  POLICY: "secondary",
  EVENT: "outline",
  GENERAL: "secondary",
};

const EMPTY_COMPOSE_FORM = { title: "", body: "", category: "GENERAL" as AnnouncementCategory };
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function AnnouncementsPageInner() {
  const user = useAuthenticatedUser();
  const canPublish = user.role === "admin" || user.role === "hr";
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data, loading, error, refetch } = useAsync(getAnnouncements);
  const [readIds, setReadIds] = React.useState<Set<string>>(new Set());
  const [selected, setSelected] = React.useState<Announcement | null>(null);
  // Deep-linked from the dashboard's "Add announcement" box via ?compose=1 -
  // read once on mount as the initial value rather than setState-in-effect.
  const [composeOpen, setComposeOpen] = React.useState(
    () => canPublish && searchParams.get("compose") === "1",
  );
  const [composeForm, setComposeForm] = React.useState(EMPTY_COMPOSE_FORM);
  const [imageUrl, setImageUrl] = React.useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = React.useState(false);
  const [imageError, setImageError] = React.useState<string | null>(null);
  const [publishing, setPublishing] = React.useState(false);
  const [publishError, setPublishError] = React.useState<string | null>(null);
  // Non-null while the compose dialog is editing an existing announcement
  // rather than creating a new one - same dialog and form, different submit.
  const [editingId, setEditingId] = React.useState<string | null>(null);

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file after removing it
    if (!file) return;
    setImageError(null);
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setImageError("Images must be a JPEG, PNG, or WEBP file.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setImageError("Image must be smaller than 5 MB.");
      return;
    }
    setUploadingImage(true);
    try {
      const result = await uploadAnnouncementImage(file);
      setImageUrl(result.url);
    } catch (err) {
      setImageError(err instanceof ApiError ? err.message : "Couldn't upload this image. Please try again.");
    } finally {
      setUploadingImage(false);
    }
  }

  function removeImage() {
    setImageUrl(null);
    setImageError(null);
  }

  React.useEffect(() => {
    if (searchParams.get("compose") === "1") {
      router.replace("/announcements");
    }
    // Only strip the deep-link param once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function open(a: Announcement) {
    setSelected(a);
    if (!a.read && !readIds.has(a.id)) {
      setReadIds((prev) => new Set(prev).add(a.id));
      markAnnouncementRead(a.id).catch(() => {
        // Best-effort - the unread dot is cosmetic and will correct itself
        // on next fetch if this silently fails.
      });
    }
  }

  function openCompose() {
    setEditingId(null);
    setComposeForm(EMPTY_COMPOSE_FORM);
    setImageUrl(null);
    setImageError(null);
    setPublishError(null);
    setComposeOpen(true);
  }

  function openEdit(a: Announcement) {
    setEditingId(a.id);
    setComposeForm({ title: a.title, body: a.body, category: a.category });
    setImageUrl(a.imageUrl);
    setImageError(null);
    setPublishError(null);
    setComposeOpen(true);
  }

  async function handleSubmit() {
    setPublishing(true);
    setPublishError(null);
    try {
      if (editingId) {
        await updateAnnouncement(editingId, {
          title: composeForm.title.trim(),
          body: composeForm.body.trim(),
          category: composeForm.category,
          imageUrl: imageUrl ?? null,
        });
        toast.success("Announcement updated");
      } else {
        await publishAnnouncement({
          title: composeForm.title.trim(),
          body: composeForm.body.trim(),
          category: composeForm.category,
          imageUrl: imageUrl ?? undefined,
        });
        toast.success("Announcement published");
      }
      setComposeOpen(false);
      refetch();
    } catch (err) {
      setPublishError(
        err instanceof ApiError
          ? err.message
          : `Couldn't ${editingId ? "save" : "publish"} this announcement. Please try again.`,
      );
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Announcements"
        description="Company-wide updates and notices."
        actions={
          canPublish && (
            <Button size="sm" onClick={openCompose}>
              <Plus />
              New announcement
            </Button>
          )
        }
      />

      <AsyncSection
        loading={loading}
        error={error}
        onRetry={refetch}
        loadingFallback={
          <div className="space-y-3">
            <CardSkeleton lines={2} />
            <CardSkeleton lines={2} />
          </div>
        }
      >
        {(data ?? []).length === 0 ? (
          <EmptyState icon={Megaphone} title="No announcements right now" />
        ) : (
          <div className="space-y-3">
            {(data ?? []).map((a) => {
              const isRead = a.read || readIds.has(a.id);
              return (
                <Card
                  key={a.id}
                  className={isRead ? undefined : "border-primary/30"}
                >
                  <CardContent className="flex items-start justify-between gap-3 pt-6">
                    <button
                      type="button"
                      onClick={() => open(a)}
                      className="min-w-0 flex-1 space-y-1 text-left"
                    >
                      <div className="flex items-center gap-2">
                        {!isRead && <span className="bg-primary size-1.5 shrink-0 rounded-full" />}
                        <p className="text-sm font-medium">{a.title}</p>
                      </div>
                      <p className="text-muted-foreground line-clamp-2 text-xs">{a.body}</p>
                      <p className="text-muted-foreground text-[11px]">{formatDate(a.publishedAt)}</p>
                    </button>
                    {a.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={a.imageUrl}
                        alt=""
                        className="size-14 shrink-0 rounded-md border object-cover"
                      />
                    )}
                    <Badge variant={categoryTone[a.category]} className="shrink-0">
                      {titleCase(a.category)}
                    </Badge>
                    {canPublish && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="shrink-0"
                        aria-label="Edit announcement"
                        onClick={() => openEdit(a)}
                      >
                        <Pencil />
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </AsyncSection>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent>
          {selected && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <Badge variant={categoryTone[selected.category]}>{titleCase(selected.category)}</Badge>
                  <span className="text-muted-foreground text-xs">{formatDate(selected.publishedAt)}</span>
                </div>
                <DialogTitle>{selected.title}</DialogTitle>
                {selected.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={selected.imageUrl}
                    alt=""
                    className="max-h-64 w-full rounded-md border object-contain"
                  />
                )}
                <DialogDescription className="text-foreground pt-2 text-sm">
                  {selected.body}
                </DialogDescription>
              </DialogHeader>
            </>
          )}
        </DialogContent>
      </Dialog>

      {canPublish && (
        <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit announcement" : "New announcement"}</DialogTitle>
              <DialogDescription>
                {editingId
                  ? "Changes are visible to every employee immediately."
                  : "Published immediately, visible to every employee."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {publishError && (
                <Alert variant="destructive">
                  <AlertDescription>{publishError}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Label htmlFor="announcement-title">Title</Label>
                <Input
                  id="announcement-title"
                  placeholder="e.g. Office closed for Diwali"
                  value={composeForm.title}
                  onChange={(e) => setComposeForm((f) => ({ ...f, title: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="announcement-body">Message</Label>
                <Textarea
                  id="announcement-body"
                  rows={5}
                  placeholder="Details for this announcement…"
                  value={composeForm.body}
                  onChange={(e) => setComposeForm((f) => ({ ...f, body: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={composeForm.category}
                  onValueChange={(v) => setComposeForm((f) => ({ ...f, category: v as AnnouncementCategory }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GENERAL">General</SelectItem>
                    <SelectItem value="HOLIDAY">Holiday</SelectItem>
                    <SelectItem value="POLICY">Policy</SelectItem>
                    <SelectItem value="EVENT">Event</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="announcement-image">Image (optional)</Label>
                {imageError && (
                  <Alert variant="destructive">
                    <AlertDescription>{imageError}</AlertDescription>
                  </Alert>
                )}
                {imageUrl ? (
                  <div className="relative w-fit">
                    {/* Uploaded content, not a static asset - next/image's
                        domain allowlisting isn't worth configuring for a
                        one-off admin preview of the image about to be
                        published. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imageUrl}
                      alt="Announcement preview"
                      className="max-h-40 rounded-md border object-contain"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="icon-sm"
                      className="absolute top-1 right-1"
                      aria-label="Remove image"
                      onClick={removeImage}
                    >
                      <X />
                    </Button>
                  </div>
                ) : (
                  <label
                    htmlFor="announcement-image"
                    className="border-input hover:bg-accent flex h-24 w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed text-sm"
                  >
                    {uploadingImage ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <>
                        <ImagePlus className="text-muted-foreground size-4" />
                        Attach an image
                      </>
                    )}
                    <input
                      id="announcement-image"
                      type="file"
                      accept={ALLOWED_IMAGE_TYPES.join(",")}
                      className="hidden"
                      disabled={uploadingImage}
                      onChange={handleImageChange}
                    />
                  </label>
                )}
                <p className="text-muted-foreground text-xs">JPEG, PNG, or WEBP, up to 5 MB.</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setComposeOpen(false)} disabled={publishing}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={
                  publishing || uploadingImage || !composeForm.title.trim() || !composeForm.body.trim()
                }
              >
                {publishing ? "Saving…" : editingId ? "Save changes" : "Publish"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

export default function AnnouncementsPage() {
  // useSearchParams needs a Suspense boundary in the app router.
  return (
    <Suspense>
      <AnnouncementsPageInner />
    </Suspense>
  );
}
