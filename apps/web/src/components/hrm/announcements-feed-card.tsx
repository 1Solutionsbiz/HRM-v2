"use client";

import Link from "next/link";
import { Megaphone } from "lucide-react";
import { useAsync } from "@/lib/use-async";
import { getAnnouncements, type AnnouncementCategory } from "@/lib/api/announcements";
import { formatRelativeTime } from "@/lib/format";
import { AsyncSection } from "@/components/hrm/async-section";
import { EmptyState } from "@/components/hrm/empty-state";
import { CardSkeleton } from "@/components/hrm/loading-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const CATEGORY_LABEL: Record<AnnouncementCategory, string> = {
  HOLIDAY: "Holiday",
  POLICY: "Policy",
  EVENT: "Event",
  GENERAL: "General",
};

export function AnnouncementsFeedCard({ className }: { className?: string } = {}) {
  const { data, loading, error, refetch } = useAsync(getAnnouncements);
  const feed = (data ?? []).slice(0, 8);

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold">Feed</CardTitle>
        <Link href="/announcements" className="text-primary text-xs font-medium hover:underline">
          View all
        </Link>
      </CardHeader>
      <CardContent>
        <AsyncSection
          loading={loading}
          error={error}
          onRetry={refetch}
          loadingFallback={<CardSkeleton lines={4} />}
        >
          {feed.length === 0 ? (
            <EmptyState size="sm" icon={Megaphone} title="No announcements yet" />
          ) : (
            <ul className="space-y-4">
              {feed.map((a) => (
                <li key={a.id} className="border-b pb-4 last:border-0 last:pb-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium">{a.title}</p>
                    {!a.read && <span className="bg-primary mt-1.5 size-1.5 shrink-0 rounded-full" />}
                  </div>
                  <p className="text-muted-foreground mt-0.5 line-clamp-2 text-xs">{a.body}</p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px]">
                      {CATEGORY_LABEL[a.category]}
                    </Badge>
                    <span className="text-muted-foreground text-[11px]">{formatRelativeTime(a.publishedAt)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </AsyncSection>
      </CardContent>
    </Card>
  );
}
