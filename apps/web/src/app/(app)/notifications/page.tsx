"use client";

import * as React from "react";
import Link from "next/link";
import { Bell, CalendarDays, Clock, Megaphone, Receipt, Settings2 } from "lucide-react";
import { useAsync } from "@/lib/use-async";
import { getNotifications, markAllNotificationsRead, markNotificationRead } from "@/lib/mock/mock-api";
import { formatRelativeTime } from "@/lib/format";
import type { AppNotification } from "@/lib/mock/fixtures";
import { PageHeader } from "@/components/hrm/page-header";
import { AsyncSection } from "@/components/hrm/async-section";
import { EmptyState } from "@/components/hrm/empty-state";
import { CardSkeleton } from "@/components/hrm/loading-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const typeIcon: Record<AppNotification["type"], React.ElementType> = {
  leave: CalendarDays,
  expense: Receipt,
  attendance: Clock,
  announcement: Megaphone,
  system: Settings2,
};

export default function NotificationsPage() {
  const { data, loading, error, refetch } = useAsync(getNotifications);

  async function handleMarkAllRead() {
    await markAllNotificationsRead();
    refetch();
  }

  async function handleOpen(n: AppNotification) {
    if (!n.read) {
      await markNotificationRead(n.id);
      refetch();
    }
  }

  const unreadCount = (data ?? []).filter((n) => !n.read).length;
  const description = loading
    ? "Loading…"
    : unreadCount > 0
      ? `${unreadCount} unread`
      : "You're all caught up";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description={description}
        actions={
          unreadCount > 0 ? (
            <Button variant="outline" size="sm" onClick={handleMarkAllRead}>
              Mark all as read
            </Button>
          ) : undefined
        }
      />

      <AsyncSection
        loading={loading}
        error={error}
        onRetry={refetch}
        loadingFallback={<CardSkeleton lines={4} />}
      >
        {(data ?? []).length === 0 ? (
          <EmptyState icon={Bell} title="No notifications" description="You'll see updates about your requests and announcements here." />
        ) : (
          <div className="space-y-2">
            {(data ?? []).map((n) => {
              const Icon = typeIcon[n.type];
              const content = (
                <Card
                  className={n.read ? undefined : "border-primary/30 bg-primary/[0.03]"}
                >
                  <CardContent className="flex items-start gap-3 pt-4 pb-4">
                    <div className="bg-muted flex size-8 shrink-0 items-center justify-center rounded-full">
                      <Icon className="text-muted-foreground size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {!n.read && <span className="bg-primary size-1.5 shrink-0 rounded-full" />}
                        <p className="text-sm font-medium">{n.title}</p>
                      </div>
                      <p className="text-muted-foreground text-xs">{n.description}</p>
                    </div>
                    <span className="text-muted-foreground shrink-0 text-[11px]">
                      {formatRelativeTime(n.createdAt)}
                    </span>
                  </CardContent>
                </Card>
              );
              return n.href ? (
                <Link key={n.id} href={n.href} onClick={() => handleOpen(n)} className="block">
                  {content}
                </Link>
              ) : (
                <button key={n.id} onClick={() => handleOpen(n)} className="block w-full text-left">
                  {content}
                </button>
              );
            })}
          </div>
        )}
      </AsyncSection>
    </div>
  );
}
