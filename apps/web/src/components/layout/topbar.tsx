"use client";

import * as React from "react";
import { Bell } from "lucide-react";
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

interface TopbarProps {
  title: string;
}

export function Topbar({ title }: TopbarProps) {
  const [hasNotifications] = React.useState(false);

  return (
    <header className="bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b px-3 backdrop-blur sm:px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-1 h-5" />
      <h1 className="truncate text-sm font-semibold sm:text-base">{title}</h1>
      <div className="ml-auto flex items-center gap-1">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative"
              aria-label="Notifications"
            >
              <Bell />
              {hasNotifications && (
                <Badge className="absolute -top-0.5 -right-0.5 size-2 rounded-full p-0" />
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-0">
            <div className="border-b px-4 py-3 text-sm font-medium">
              Notifications
            </div>
            <div className="p-2">
              <EmptyState
                size="sm"
                icon={Bell}
                title="You're all caught up"
                description="New notifications will show up here."
              />
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </header>
  );
}
