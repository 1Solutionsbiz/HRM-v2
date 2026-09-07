"use client";

import Link from "next/link";
import { LifeBuoy } from "lucide-react";
import { useAsync } from "@/lib/use-async";
import { getMyTickets } from "@/lib/api/tickets";
import { AsyncSection } from "@/components/hrm/async-section";
import { CardSkeleton } from "@/components/hrm/loading-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function TicketsSummaryCard() {
  const { data, loading, error, refetch } = useAsync(getMyTickets);
  const tickets = data ?? [];
  const openCount = tickets.filter((t) => t.status === "OPEN" || t.status === "IN_PROGRESS").length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold">My tickets</CardTitle>
      </CardHeader>
      <CardContent>
        <AsyncSection
          loading={loading}
          error={error}
          onRetry={refetch}
          loadingFallback={<CardSkeleton lines={2} />}
        >
          <div className="flex items-center gap-4">
            <div className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
              <LifeBuoy className="size-4.5" />
            </div>
            <div>
              <p className="text-2xl font-semibold tabular-nums">{openCount}</p>
              <p className="text-muted-foreground text-xs">Open / in progress</p>
            </div>
          </div>
        </AsyncSection>
        <Button asChild variant="outline" className="mt-4 w-full">
          <Link href="/support">View tickets</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
