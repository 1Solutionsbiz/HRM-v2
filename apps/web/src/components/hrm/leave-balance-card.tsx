"use client";

import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { useAsync } from "@/lib/use-async";
import { getLeaveBalances } from "@/lib/api/leave";
import { AsyncSection } from "@/components/hrm/async-section";
import { EmptyState } from "@/components/hrm/empty-state";
import { CardSkeleton } from "@/components/hrm/loading-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function LeaveBalanceCard() {
  const { data, loading, error, refetch } = useAsync(getLeaveBalances);
  const balances = data ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold">Leave balance</CardTitle>
      </CardHeader>
      <CardContent>
        <AsyncSection
          loading={loading}
          error={error}
          onRetry={refetch}
          loadingFallback={<CardSkeleton lines={2} />}
        >
          {balances.length === 0 ? (
            <EmptyState size="sm" icon={CalendarDays} title="No leave types configured" />
          ) : (
            <div className="mb-4 flex gap-4">
              {balances.slice(0, 2).map((b, i) => (
                <div key={b.leaveTypeId} className="flex items-center gap-4">
                  {i > 0 && <div className="bg-border h-8 w-px" />}
                  <div>
                    <p className="text-2xl font-semibold tabular-nums">{b.remainingDays}</p>
                    <p className="text-muted-foreground truncate text-xs">{b.leaveTypeName}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </AsyncSection>
        <Button asChild className="w-full bg-[#fe9700] text-[#0b0b0b] hover:bg-[#fe9700]/85">
          <Link href="/leave/apply">Apply Leave</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
