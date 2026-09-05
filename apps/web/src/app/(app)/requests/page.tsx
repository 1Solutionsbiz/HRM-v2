"use client";

import * as React from "react";
import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { useAsync } from "@/lib/use-async";
import { getMyRequests } from "@/lib/mock/mock-api";
import { formatDate } from "@/lib/format";
import { PageHeader } from "@/components/hrm/page-header";
import { StatusBadge } from "@/components/hrm/status-badge";
import { AsyncSection } from "@/components/hrm/async-section";
import { EmptyState } from "@/components/hrm/empty-state";
import { TableSkeleton } from "@/components/hrm/loading-state";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function RequestsPage() {
  const { data, loading, error, refetch } = useAsync(getMyRequests);
  const [tab, setTab] = React.useState("all");

  const filtered = (data ?? []).filter((r) => {
    if (tab === "all") return true;
    if (tab === "pending") return r.status === "Pending";
    return r.kind.toLowerCase() === tab;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Requests"
        description="Everything you've submitted for approval, in one place."
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="leave">Leave</TabsTrigger>
          <TabsTrigger value="expense">Expense</TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <AsyncSection
                loading={loading}
                error={error}
                onRetry={refetch}
                loadingFallback={<TableSkeleton rows={4} columns={4} />}
              >
                {filtered.length === 0 ? (
                  <EmptyState
                    icon={ClipboardList}
                    title="No requests here"
                    description="Requests you submit for leave or expenses will show up here."
                    action={
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" asChild>
                          <Link href="/leave/apply">Apply leave</Link>
                        </Button>
                        <Button size="sm" variant="outline" asChild>
                          <Link href="/expenses/add">Add expense</Link>
                        </Button>
                      </div>
                    }
                  />
                ) : (
                  <ul className="divide-y">
                    {filtered.map((r) => (
                      <li key={`${r.kind}-${r.id}`} className="flex items-center justify-between gap-3 py-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {r.kind} · {r.title}
                          </p>
                          <p className="text-muted-foreground truncate text-xs">
                            {r.detail} · Submitted {formatDate(r.submittedOn)}
                          </p>
                        </div>
                        <StatusBadge status={r.status} className="shrink-0" />
                      </li>
                    ))}
                  </ul>
                )}
              </AsyncSection>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
