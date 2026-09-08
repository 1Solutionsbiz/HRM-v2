"use client";

import { CheckCircle2, Circle, UserPlus } from "lucide-react";
import { useAsync } from "@/lib/use-async";
import { formatDate } from "@/lib/format";
import { getOnboardingRoster, employeeFullName, employeeInitials } from "@/lib/api/employees";
import { PageHeader } from "@/components/hrm/page-header";
import { AsyncSection } from "@/components/hrm/async-section";
import { EmptyState } from "@/components/hrm/empty-state";
import { CardSkeleton } from "@/components/hrm/loading-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export default function OnboardingPage() {
  const { data, loading, error, refetch } = useAsync(getOnboardingRoster);

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
              const done = c.onboardingSteps.filter((s) => s.isCompleted).length;
              const total = c.onboardingSteps.length;
              const progress = total > 0 ? Math.round((done / total) * 100) : 0;
              return (
                <Card key={c.id}>
                  <CardHeader className="flex flex-row items-center gap-3">
                    <Avatar className="size-9">
                      <AvatarFallback>{employeeInitials(c)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-sm">{employeeFullName(c)}</CardTitle>
                      <p className="text-muted-foreground text-xs">
                        {c.designation?.title ?? "—"} · {c.department?.name ?? "—"} · Joined {formatDate(c.dateOfJoining)}
                      </p>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Progress value={progress} className="flex-1" />
                      <span className="text-muted-foreground w-16 shrink-0 text-right text-xs tabular-nums">
                        {done}/{total} steps
                      </span>
                    </div>
                    <ul className="space-y-1.5">
                      {c.onboardingSteps.map((s) => (
                        <li key={s.id} className="flex items-center gap-2 text-xs">
                          {s.isCompleted ? (
                            <CheckCircle2 className="text-success size-3.5 shrink-0" />
                          ) : (
                            <Circle className="text-muted-foreground size-3.5 shrink-0" />
                          )}
                          <span className={s.isCompleted ? "text-muted-foreground line-through" : ""}>
                            {s.stepTemplate.name}
                          </span>
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
