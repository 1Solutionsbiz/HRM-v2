"use client";

import * as React from "react";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Megaphone, Plus } from "lucide-react";
import { useAuthenticatedUser } from "@/lib/auth-context";
import { useAsync } from "@/lib/use-async";
import { ApiError } from "@/lib/api-client";
import {
  getAnnouncements,
  markAnnouncementRead,
  publishAnnouncement,
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
  const [publishing, setPublishing] = React.useState(false);
  const [publishError, setPublishError] = React.useState<string | null>(null);

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
    setComposeForm(EMPTY_COMPOSE_FORM);
    setPublishError(null);
    setComposeOpen(true);
  }

  async function handlePublish() {
    setPublishing(true);
    setPublishError(null);
    try {
      await publishAnnouncement({
        title: composeForm.title.trim(),
        body: composeForm.body.trim(),
        category: composeForm.category,
      });
      toast.success("Announcement published");
      setComposeOpen(false);
      refetch();
    } catch (err) {
      setPublishError(err instanceof ApiError ? err.message : "Couldn't publish this announcement. Please try again.");
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
                  <button
                    type="button"
                    onClick={() => open(a)}
                    className="w-full text-left"
                  >
                    <CardContent className="flex items-start justify-between gap-3 pt-6">
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          {!isRead && <span className="bg-primary size-1.5 shrink-0 rounded-full" />}
                          <p className="text-sm font-medium">{a.title}</p>
                        </div>
                        <p className="text-muted-foreground line-clamp-2 text-xs">{a.body}</p>
                        <p className="text-muted-foreground text-[11px]">{formatDate(a.publishedAt)}</p>
                      </div>
                      <Badge variant={categoryTone[a.category]} className="shrink-0">
                        {titleCase(a.category)}
                      </Badge>
                    </CardContent>
                  </button>
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
              <DialogTitle>New announcement</DialogTitle>
              <DialogDescription>Published immediately, visible to every employee.</DialogDescription>
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
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setComposeOpen(false)} disabled={publishing}>
                Cancel
              </Button>
              <Button
                onClick={handlePublish}
                disabled={publishing || !composeForm.title.trim() || !composeForm.body.trim()}
              >
                {publishing ? "Publishing…" : "Publish"}
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
