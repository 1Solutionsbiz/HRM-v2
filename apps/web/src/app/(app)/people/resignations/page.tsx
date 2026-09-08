"use client";

import * as React from "react";
import { toast } from "sonner";
import { UserMinus } from "lucide-react";
import { useAsync } from "@/lib/use-async";
import { formatDate } from "@/lib/format";
import {
  decideResignation,
  getCompanyResignations,
  type CompanyResignation,
} from "@/lib/api/resignations";
import { employeeFullName, employeeInitials, titleCase } from "@/lib/api/employees";
import { PageHeader } from "@/components/hrm/page-header";
import { StatusBadge } from "@/components/hrm/status-badge";
import { AsyncSection } from "@/components/hrm/async-section";
import { EmptyState } from "@/components/hrm/empty-state";
import { ConfirmDialog } from "@/components/hrm/confirm-dialog";
import { CardSkeleton } from "@/components/hrm/loading-state";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

export default function ResignationsPage() {
  const { data, loading, error, refetch } = useAsync(getCompanyResignations);
  const [decision, setDecision] = React.useState<{ id: string; name: string; kind: "APPROVED" | "DECLINED" } | null>(null);

  async function handleDecide() {
    if (!decision) return;
    await decideResignation(decision.id, decision.kind);
    toast.success(`${decision.name}'s resignation ${decision.kind === "APPROVED" ? "approved" : "declined"}`);
    refetch();
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Resignations" description="Review resignation requests and notice periods." />

      <AsyncSection
        loading={loading}
        error={error}
        onRetry={refetch}
        loadingFallback={<CardSkeleton lines={4} />}
      >
        {(data ?? []).length === 0 ? (
          <EmptyState icon={UserMinus} title="No resignation requests" />
        ) : (
          <div className="space-y-3">
            {(data ?? []).map((r: CompanyResignation) => (
              <Card key={r.id}>
                <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="size-9 shrink-0">
                      <AvatarFallback>{employeeInitials(r.employee)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{employeeFullName(r.employee)}</p>
                      <p className="text-muted-foreground text-xs">
                        {r.employee.designation?.title ?? "—"} · {r.employee.department?.name ?? "—"}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        Last working day {formatDate(r.lastWorkingDay)} · {r.noticePeriodDays}-day notice ·{" "}
                        {r.reason}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <StatusBadge status={titleCase(r.status)} />
                    {r.status === "PENDING" && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setDecision({ id: r.id, name: employeeFullName(r.employee), kind: "DECLINED" })}
                        >
                          Decline
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => setDecision({ id: r.id, name: employeeFullName(r.employee), kind: "APPROVED" })}
                        >
                          Approve
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </AsyncSection>

      <ConfirmDialog
        open={!!decision}
        onOpenChange={(open) => !open && setDecision(null)}
        title={decision?.kind === "APPROVED" ? "Approve this resignation?" : "Decline this resignation?"}
        description={
          decision
            ? `This will mark ${decision.name}'s resignation as ${decision.kind === "APPROVED" ? "approved" : "declined"}.`
            : ""
        }
        confirmLabel={decision?.kind === "APPROVED" ? "Approve" : "Decline"}
        variant={decision?.kind === "DECLINED" ? "destructive" : "default"}
        onConfirm={handleDecide}
      />
    </div>
  );
}
