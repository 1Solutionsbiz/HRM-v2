"use client";

import { Award, Cake } from "lucide-react";
import { useAsync } from "@/lib/use-async";
import { formatDateShort } from "@/lib/format";
import { getEmployees, getUpcomingBirthdays, employeeFullName, nextWorkAnniversary } from "@/lib/api/employees";
import { AsyncSection } from "@/components/hrm/async-section";
import { EmptyState } from "@/components/hrm/empty-state";
import { CardSkeleton } from "@/components/hrm/loading-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toneClasses } from "@/lib/tone";
import { cn } from "@/lib/utils";

const HIGHLIGHT_WINDOW_DAYS = 30;

type Highlight =
  | { kind: "birthday"; id: string; name: string; department: string | null; date: Date; daysUntil: number }
  | {
      kind: "anniversary";
      id: string;
      name: string;
      department: string | null;
      date: Date;
      daysUntil: number;
      years: number;
    };

/**
 * Shared between the admin dashboard and the employee /my-day page - same
 * birthday/anniversary computation, same look, so it doesn't drift into two
 * different "highlights" concepts.
 */
export function HighlightsCard() {
  const employees = useAsync(getEmployees);
  const birthdays = useAsync(getUpcomingBirthdays);

  const activeEmployees = (employees.data ?? []).filter((e) => e.status === "ACTIVE");

  const upcomingAnniversaries = activeEmployees
    .map((e) => {
      const { nextAnniversary, daysUntil, years } = nextWorkAnniversary(e.dateOfJoining);
      return { employee: e, nextAnniversary, daysUntil, years };
    })
    .filter((a) => a.daysUntil <= HIGHLIGHT_WINDOW_DAYS);

  const highlights: Highlight[] = [
    ...(birthdays.data ?? []).map((b) => ({
      kind: "birthday" as const,
      id: b.id,
      name: employeeFullName(b),
      department: b.department?.name ?? null,
      date: new Date(b.nextBirthday),
      daysUntil: b.daysUntil,
    })),
    ...upcomingAnniversaries.map((a) => ({
      kind: "anniversary" as const,
      id: a.employee.id,
      name: employeeFullName(a.employee),
      department: a.employee.department?.name ?? null,
      date: a.nextAnniversary,
      daysUntil: a.daysUntil,
      years: a.years,
    })),
  ].sort((a, b) => a.daysUntil - b.daysUntil);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold">Highlights</CardTitle>
        <Cake className="text-muted-foreground size-4" />
      </CardHeader>
      <CardContent>
        <AsyncSection
          loading={employees.loading || birthdays.loading}
          error={employees.error || birthdays.error}
          onRetry={() => {
            employees.refetch();
            birthdays.refetch();
          }}
          loadingFallback={<CardSkeleton lines={3} />}
        >
          {highlights.length === 0 ? (
            <EmptyState size="sm" icon={Cake} title="No birthdays or anniversaries in the next 30 days" />
          ) : (
            <ul className="space-y-3">
              {highlights.map((h) => (
                <li key={`${h.kind}-${h.id}`} className="flex items-center gap-2.5">
                  <div
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-full",
                      toneClasses[h.kind === "birthday" ? "orange" : "violet"],
                    )}
                  >
                    {h.kind === "birthday" ? <Cake className="size-4" /> : <Award className="size-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{h.name}</p>
                    <p className="text-muted-foreground truncate text-xs">
                      {h.daysUntil === 0 ? "Today" : formatDateShort(h.date)}
                      {" · "}
                      {h.kind === "birthday" ? "Birthday" : `${h.years} yr${h.years > 1 ? "s" : ""} anniversary`}
                      {h.department && ` · ${h.department}`}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </AsyncSection>
      </CardContent>
    </Card>
  );
}
