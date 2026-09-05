"use client";

import { CheckCircle2, Circle, UserPlus } from "lucide-react";
import { useAsync } from "@/lib/use-async";
import { formatDate } from "@/lib/format";
import { getOnboardingCandidates } from "@/lib/mock/mock-api";
import { PageHeader } from "@/components/hrm/page-header";
import { AsyncSection } from "@/components/hrm/async-section";
import { EmptyState } from "@/components/hrm/empty-state";
import { CardSkeleton } from "@/components/hrm/loading-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export default function OnboardingPage() {
  const { data, loading, error, refetch } = useAsync(getOnboardingCandidates);

  return (
    <div className="space-y-6">
      <PageHeader title="Onboarding" description="Track new hire onboarding checklists." />

      <AsyncSection
        loading={loading}
        error={error}
        onRetry={refetch}
        loadingFallback={
          <div className="grid gap-4 lg:grid-cols-2">
            <CardSkeleton lines={4} />
            <CardSkeleton lines={4} />
          </div>
        }
      >
        {(data ?? []).length === 0 ? (
          <EmptyState icon={UserPlus} title="No one is onboarding right now" />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {(data ?? []).map((c) => {
              const done = c.steps.filter((s) => s.done).length;
              const progress = Math.round((done / c.steps.length) * 100);
              return (
                <Card key={c.id}>
                  <CardHeader className="flex flex-row items-center gap-3">
                    <Avatar className="size-9">
                      <AvatarFallback>{c.avatarInitials}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-sm">{c.name}</CardTitle>
                      <p className="text-muted-foreground text-xs">
                        {c.designation} · {c.department} · Joined {formatDate(c.doj)}
                      </p>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Progress value={progress} className="flex-1" />
                      <span className="text-muted-foreground w-16 shrink-0 text-right text-xs tabular-nums">
                        {done}/{c.steps.length} steps
                      </span>
                    </div>
                    <ul className="space-y-1.5">
                      {c.steps.map((s) => (
                        <li key={s.name} className="flex items-center gap-2 text-xs">
                          {s.done ? (
                            <CheckCircle2 className="text-success size-3.5 shrink-0" />
                          ) : (
                            <Circle className="text-muted-foreground size-3.5 shrink-0" />
                          )}
                          <span className={s.done ? "text-muted-foreground line-through" : ""}>{s.name}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </AsyncSection>
    </div>
  );
}
