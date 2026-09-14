"use client";

import * as React from "react";
import { toast } from "sonner";
import { CheckCircle2, Circle, Loader2, UserPlus } from "lucide-react";
import { useAsync } from "@/lib/use-async";
import { ApiError } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import {
  getOnboardingRoster,
  completeOnboardingStep,
  employeeFullName,
  employeeInitials,
  type OnboardingRosterEmployee,
} from "@/lib/api/employees";
import { PageHeader } from "@/components/hrm/page-header";
import { AsyncSection } from "@/components/hrm/async-section";
import { EmptyState } from "@/components/hrm/empty-state";
import { CardSkeleton } from "@/components/hrm/loading-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export default function OnboardingPage() {
  const { data, loading, error, refetch } = useAsync(getOnboardingRoster);
  // employeeId:stepId of whichever step is mid-request - disables just that
  // one row rather than the whole page while it's in flight.
  const [pendingKey, setPendingKey] = React.useState<string | null>(null);

  async function handleCompleteStep(employee: OnboardingRosterEmployee, stepId: string) {
    const key = `${employee.id}:${stepId}`;
    setPendingKey(key);
    try {
      await completeOnboardingStep(employee.id, stepId);
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't mark this step complete. Please try again.");
    } finally {
      setPendingKey(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Onboarding" description="Track new hire onboarding checklists. Click a step to mark it done." />

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
                      {c.onboardingSteps.map((s) => {
                        const key = `${c.id}:${s.id}`;
                        const isPending = pendingKey === key;
                        return (
                          <li key={s.id}>
                            <button
                              type="button"
                              disabled={s.isCompleted || isPending}
                              onClick={() => handleCompleteStep(c, s.id)}
                              className="flex w-full items-center gap-2 rounded px-1 py-0.5 text-left text-xs enabled:hover:bg-accent disabled:cursor-default"
                            >
                              {isPending ? (
                                <Loader2 className="text-muted-foreground size-3.5 shrink-0 animate-spin" />
                              ) : s.isCompleted ? (
                                <CheckCircle2 className="text-success size-3.5 shrink-0" />
                              ) : (
                                <Circle className="text-muted-foreground size-3.5 shrink-0" />
                              )}
                              <span className={s.isCompleted ? "text-muted-foreground line-through" : ""}>
                                {s.stepTemplate.name}
                              </span>
                            </button>
                          </li>
                        );
                      })}
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
