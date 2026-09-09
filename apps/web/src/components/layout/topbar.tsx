"use client";

import * as React from "react";
import Link from "next/link";
import { Bell, ChevronRight } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { EmptyState } from "@/components/hrm/empty-state";
import { useAsync } from "@/lib/use-async";
import { getNotifications, markNotificationRead, type AppNotification } from "@/lib/api/notifications";
import { formatRelativeTime } from "@/lib/format";
import { getBreadcrumb } from "@/lib/page-title";
import { ThemeToggle } from "@/components/layout/theme-toggle";

interface TopbarProps {
  pathname: string;
}

export function Topbar({ pathname }: TopbarProps) {
  const { data, refetch } = useAsync(getNotifications);
  const notifications = data ?? [];
  const unread = notifications.filter((n) => !n.isRead);
  const breadcrumb = getBreadcrumb(pathname);

  async function handleOpenNotification(n: AppNotification) {
    if (!n.isRead) {
      await markNotificationRead(n.id);
      refetch();
    }
  }

  return (
    <header className="bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b px-3 backdrop-blur sm:px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-1 h-5" />
      <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
        <ol className="text-muted-foreground flex items-center gap-1 truncate text-sm">
          {breadcrumb.map((crumb, i) => {
            const isLast = i === breadcrumb.length - 1;
            return (
              <li key={i} className="flex min-w-0 items-center gap-1">
                {i > 0 && <ChevronRight className="size-3.5 shrink-0" />}
                {crumb.url ? (
                  <Link href={crumb.url} className="hover:text-foreground truncate">
                    {crumb.label}
                  </Link>
                ) : (
                  <span className={isLast ? "text-foreground truncate font-medium" : "truncate"}>
                    {crumb.label}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
      <div className="ml-auto flex items-center gap-1">
        <ThemeToggle />

        <Popover onOpenChange={(open) => open && refetch()}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative"
              aria-label="Notifications"
            >
              <Bell />
              {unread.length > 0 && (
                <Badge className="absolute -top-0.5 -right-0.5 size-2 rounded-full p-0" />
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-0">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <span className="text-sm font-medium">Notifications</span>
              {unread.length > 0 && (
                <span className="text-muted-foreground text-xs">{unread.length} unread</span>
              )}
            </div>
            {notifications.length === 0 ? (
              <div className="p-2">
                <EmptyState
                  size="sm"
                  icon={Bell}
                  title="You're all caught up"
                  description="New notifications will show up here."
                />
              </div>
            ) : (
              <ul className="max-h-72 divide-y overflow-y-auto">
                {notifications.slice(0, 4).map((n) => (
                  <li key={n.id}>
                    <Link
                      href={n.linkUrl ?? "/notifications"}
                      onClick={() => handleOpenNotification(n)}
                      className="hover:bg-accent block px-4 py-2.5"
                    >
                      <div className="flex items-center gap-2">
                        {!n.isRead && <span className="bg-primary size-1.5 shrink-0 rounded-full" />}
                        <p className="truncate text-sm font-medium">{n.title}</p>
                      </div>
                      <p className="text-muted-foreground line-clamp-1 text-xs">{n.description}</p>
                      <p className="text-muted-foreground text-[10px]">{formatRelativeTime(n.createdAt)}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <div className="border-t p-2">
              <Link
                href="/notifications"
                className="text-primary block rounded-md px-2 py-1.5 text-center text-xs font-medium hover:underline"
              >
                View all notifications
              </Link>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </header>
  );
}
