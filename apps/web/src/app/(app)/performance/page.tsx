"use client";

import { Award, Star, Target } from "lucide-react";
import { useAsync } from "@/lib/use-async";
import { getMyPerformance } from "@/lib/api/performance";
import { employeeFullName } from "@/lib/api/employees";
import { formatDate } from "@/lib/format";
import { PageHeader } from "@/components/hrm/page-header";
import { AsyncSection } from "@/components/hrm/async-section";
import { EmptyState } from "@/components/hrm/empty-state";
import { CardSkeleton } from "@/components/hrm/loading-state";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

export default function PerformancePage() {
  const { data, loading, error, refetch } = useAsync(getMyPerformance);

  return (
    <div className="space-y-6">
      <PageHeader title="Performance" description="Your current goals, latest review, and recognition." />

      <AsyncSection
        loading={loading}
        error={error}
        onRetry={refetch}
        loadingFallback={
          <div className="grid gap-4 lg:grid-cols-2">
            <CardSkeleton lines={3} />
            <CardSkeleton lines={3} />
          </div>
        }
      >
        {data && (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base">Current goals</CardTitle>
                  <CardDescription>
                    {data.cycle ? `${data.cycle.name} · ends ${formatDate(data.cycle.endDate)}` : "No active review cycle"}
                  </CardDescription>
                </div>
                <Target className="text-muted-foreground size-4" />
              </CardHeader>
              <CardContent>
                {data.goals.length === 0 ? (
                  <EmptyState size="sm" icon={Target} title="No goals set for this cycle" />
                ) : (
                  <div className="space-y-4">
                    {data.goals.map((g) => (
                      <div key={g.id} className="space-y-1.5">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">{g.title}</span>
                          <span className="text-muted-foreground text-xs">
                            {g.dueDate ? `Due ${formatDate(g.dueDate)}` : "No due date"}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <Progress value={g.progressPercent} className="flex-1" />
                          <span className="text-muted-foreground w-9 shrink-0 text-right text-xs tabular-nums">
                            {g.progressPercent}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base">Last review</CardTitle>
                  <Star className="text-muted-foreground size-4" />
                </CardHeader>
                <CardContent>
                  {data.lastReview ? (
                    <div className="space-y-2">
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-semibold">{data.lastReview.rating}</span>
                        <span className="text-muted-foreground text-sm">/ {data.lastReview.maxRating}</span>
                      </div>
                      <p className="text-sm">{data.lastReview.summary}</p>
                      <p className="text-muted-foreground text-xs">
                        {data.lastReview.cycle.name} · Reviewed by{" "}
                        {data.lastReview.reviewedByUser.employee
                          ? employeeFullName(data.lastReview.reviewedByUser.employee)
                          : "HR"}{" "}
                        on {formatDate(data.lastReview.reviewedAt)}
                      </p>
                    </div>
                  ) : (
                    <EmptyState size="sm" icon={Star} title="No review yet" />
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base">Recognition</CardTitle>
                  <Award className="text-muted-foreground size-4" />
                </CardHeader>
                <CardContent>
                  {data.recognitions.length === 0 ? (
                    <EmptyState size="sm" icon={Award} title="No recognition yet" />
                  ) : (
                    <ul className="space-y-3">
                      {data.recognitions.map((r) => (
                        <li key={r.id} className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium">{r.title}</p>
                            <p className="text-muted-foreground text-xs">{r.source}</p>
                          </div>
                          <Badge variant="secondary" className="shrink-0 text-[10px]">
                            {formatDate(r.awardedAt)}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </AsyncSection>
    </div>
  );
}
