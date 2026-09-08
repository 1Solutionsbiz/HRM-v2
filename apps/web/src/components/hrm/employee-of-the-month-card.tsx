"use client";

import { Sparkles } from "lucide-react";
import { useAsync } from "@/lib/use-async";
import { getCurrentEmployeeOfTheMonth, type EmployeeOfTheMonthAward } from "@/lib/api/employee-of-the-month";
import { employeeInitials, employeeFullName } from "@/lib/api/employees";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

/**
 * Dashboard-only display - returns null with nothing nominated yet, same
 * "quietly absent" pattern as PollsDashboardWidget. Nomination itself lives
 * on /recognition, not here.
 */
export function EmployeeOfTheMonthCard({ className }: { className?: string } = {}) {
  const { data: award } = useAsync(getCurrentEmployeeOfTheMonth);

  if (!award) return null;

  return <EmployeeOfTheMonthDisplay award={award} className={className} />;
}

export function EmployeeOfTheMonthDisplay({
  award,
  className,
}: {
  award: EmployeeOfTheMonthAward;
  className?: string;
}) {
  const { employee } = award;

  return (
    <Card className={className}>
      <CardContent className="flex items-center gap-4 pt-6">
        <div className="relative shrink-0">
          <Sparkles className="text-primary absolute -top-2 -left-2 size-4 animate-pulse" />
          <Sparkles className="text-primary absolute -right-2 -bottom-1 size-3 animate-pulse [animation-delay:300ms]" />
          <Avatar size="lg">
            {employee.avatarUrl && <AvatarImage src={employee.avatarUrl} alt="" />}
            <AvatarFallback>{employeeInitials(employee)}</AvatarFallback>
          </Avatar>
        </div>
        <div className="min-w-0">
          <p className="text-muted-foreground text-xs font-medium">Employee of the month</p>
          <p className="truncate text-sm font-semibold">{employeeFullName(employee)}</p>
          <p className="text-muted-foreground truncate text-xs">
            {employee.designation?.title ?? "—"}
            {employee.department && ` · ${employee.department.name}`}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
