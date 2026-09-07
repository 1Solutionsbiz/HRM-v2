"use client";

import Link from "next/link";
import { History } from "lucide-react";
import { PageHeader } from "@/components/hrm/page-header";
import { AttendanceCard } from "@/components/hrm/attendance-card";
import { AttendanceMonthGrid } from "@/components/hrm/attendance-month-grid";
import { Button } from "@/components/ui/button";

export default function AttendancePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance"
        description="Check in and out, and see how this month is shaping up."
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/attendance/history">
              <History />
              View history
            </Link>
          </Button>
        }
      />

      <AttendanceCard variant="full" />

      <AttendanceMonthGrid />
    </div>
  );
}
