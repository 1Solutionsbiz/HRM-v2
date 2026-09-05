"use client";

import { Award, Star, Target } from "lucide-react";
import { useAsync } from "@/lib/use-async";
import { getPerformance } from "@/lib/mock/mock-api";
import { formatDate } from "@/lib/format";
import { PageHeader } from "@/components/hrm/page-header";
import { AsyncSection } from "@/components/hrm/async-section";
import { EmptyState } from "@/components/hrm/empty-state";
import { CardSkeleton } from "@/components/hrm/loading-state";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

export default function PerformancePage() {
  const { data, loading, error, refetch } = useAsync(getPerformance);

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
                  <CardDescription>{data.cycle.name} · ends {formatDate(data.cycle.endsOn)}</CardDescription>
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
                          <span className="text-muted-foreground text-xs">{g.dueLabel}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <Progress value={g.progress} className="flex-1" />
                          <span className="text-muted-foreground w-9 shrink-0 text-right text-xs tabular-nums">
                            {g.progress}%
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
                <CardContent className="space-y-2">
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-semibold">{data.lastReview.rating}</span>
                    <span className="text-muted-foreground text-sm">/ {data.lastReview.outOf}</span>
                  </div>
                  <p className="text-sm">{data.lastReview.summary}</p>
                  <p className="text-muted-foreground text-xs">
                    {data.lastReview.cycle} · Reviewed by {data.lastReview.reviewedBy} on{" "}
                    {formatDate(data.lastReview.date)}
                  </p>
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
                        <li key={r.title} className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium">{r.title}</p>
                            <p className="text-muted-foreground text-xs">{r.from}</p>
                          </div>
                          <Badge variant="secondary" className="shrink-0 text-[10px]">
                            {formatDate(r.date)}
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
