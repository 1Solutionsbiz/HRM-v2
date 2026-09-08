"use client";

import * as React from "react";
import { Trophy, Plus } from "lucide-react";
import { useAsync } from "@/lib/use-async";
import { useAuthenticatedUser } from "@/lib/auth-context";
import { getCurrentEmployeeOfTheMonth } from "@/lib/api/employee-of-the-month";
import { getEmployees } from "@/lib/api/employees";
import { formatDate } from "@/lib/format";
import { PageHeader } from "@/components/hrm/page-header";
import { AsyncSection } from "@/components/hrm/async-section";
import { EmptyState } from "@/components/hrm/empty-state";
import { CardSkeleton } from "@/components/hrm/loading-state";
import { EmployeeOfTheMonthDisplay } from "@/components/hrm/employee-of-the-month-card";
import { NominateEmployeeOfTheMonthDialog } from "@/components/hrm/nominate-employee-of-the-month-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function RecognitionPage() {
  const user = useAuthenticatedUser();
  const canManage = user.role === "admin" || user.role === "hr";
  const { data: award, loading, error, refetch } = useAsync(getCurrentEmployeeOfTheMonth);
  const { data: employees } = useAsync(getEmployees);
  const [nominateOpen, setNominateOpen] = React.useState(false);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Employee of the month"
        description="Celebrate the team's top performer this month."
        actions={
          canManage ? (
            <Button size="sm" onClick={() => setNominateOpen(true)}>
              <Plus />
              Nominate
            </Button>
          ) : undefined
        }
      />

      <AsyncSection loading={loading} error={error} onRetry={refetch} loadingFallback={<CardSkeleton lines={3} />}>
        {award ? (
          <div className="space-y-3">
            <EmployeeOfTheMonthDisplay award={award} />
            {award.note && (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-muted-foreground text-xs font-medium">Why this pick</p>
                  <p className="mt-1 text-sm">{award.note}</p>
                </CardContent>
              </Card>
            )}
            <p className="text-muted-foreground text-xs">
              Nominated {formatDate(award.nominatedAt, { day: "numeric", month: "short", year: "numeric" })}
            </p>
          </div>
        ) : (
          <EmptyState
            icon={Trophy}
            title="Nobody's been nominated yet this month"
            description={canManage ? "Pick a standout employee to celebrate." : undefined}
          />
        )}
      </AsyncSection>

      {nominateOpen && (
        <NominateEmployeeOfTheMonthDialog
          employees={employees ?? []}
          onClose={() => setNominateOpen(false)}
          onNominated={refetch}
        />
      )}
    </div>
  );
}
