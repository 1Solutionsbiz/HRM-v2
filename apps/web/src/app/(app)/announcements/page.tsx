"use client";

import * as React from "react";
import { Megaphone } from "lucide-react";
import { useAsync } from "@/lib/use-async";
import { getAnnouncements } from "@/lib/mock/mock-api";
import { formatDate } from "@/lib/format";
import type { Announcement } from "@/lib/mock/fixtures";
import { PageHeader } from "@/components/hrm/page-header";
import { AsyncSection } from "@/components/hrm/async-section";
import { EmptyState } from "@/components/hrm/empty-state";
import { CardSkeleton } from "@/components/hrm/loading-state";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const categoryTone: Record<Announcement["category"], "default" | "secondary" | "outline"> = {
  Holiday: "default",
  Policy: "secondary",
  Event: "outline",
  General: "secondary",
};

export default function AnnouncementsPage() {
  const { data, loading, error, refetch } = useAsync(getAnnouncements);
  const [readIds, setReadIds] = React.useState<Set<string>>(new Set());
  const [selected, setSelected] = React.useState<Announcement | null>(null);

  function open(a: Announcement) {
    setSelected(a);
    setReadIds((prev) => new Set(prev).add(a.id));
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Announcements" description="Company-wide updates and notices." />

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
                        {a.category}
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
                  <Badge variant={categoryTone[selected.category]}>{selected.category}</Badge>
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
    </div>
  );
}
