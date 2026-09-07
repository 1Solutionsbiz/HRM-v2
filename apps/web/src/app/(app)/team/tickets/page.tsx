"use client";

import * as React from "react";
import { LifeBuoy, MessageSquare, AlertCircle, Clock, CheckCircle2, Archive } from "lucide-react";
import { useAuthenticatedUser } from "@/lib/auth-context";
import { useAsync } from "@/lib/use-async";
import { employeeFullName, employeeInitials } from "@/lib/api/employees";
import {
  getCompanyTickets,
  TICKET_CATEGORY_LABEL,
  TICKET_STATUS_LABEL,
  TICKET_STATUS_TONE,
  type Ticket,
  type TicketStatus,
} from "@/lib/api/tickets";
import { formatDate } from "@/lib/format";
import { PageHeader } from "@/components/hrm/page-header";
import { StatCard } from "@/components/hrm/stat-card";
import { StatusBadge } from "@/components/hrm/status-badge";
import { AsyncSection } from "@/components/hrm/async-section";
import { EmptyState } from "@/components/hrm/empty-state";
import { StatGridSkeleton, TableSkeleton } from "@/components/hrm/loading-state";
import { TicketDetailSheet } from "@/components/hrm/ticket-detail-sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type TabValue = "ALL" | TicketStatus;

export default function TicketManagementPage() {
  const user = useAuthenticatedUser();
  const { data, loading, error, refetch } = useAsync(getCompanyTickets);
  const [tab, setTab] = React.useState<TabValue>("ALL");
  const [selected, setSelected] = React.useState<Ticket | null>(null);

  const tickets = data ?? [];
  const open = tickets.filter((t) => t.status === "OPEN");
  const inProgress = tickets.filter((t) => t.status === "IN_PROGRESS");
  const resolved = tickets.filter((t) => t.status === "RESOLVED");
  const closed = tickets.filter((t) => t.status === "CLOSED");

  const filtered = tab === "ALL" ? tickets : tickets.filter((t) => t.status === tab);

  function renderTable(rows: Ticket[]) {
    if (rows.length === 0) {
      return (
        <Card>
          <CardContent className="pt-6">
            <EmptyState icon={LifeBuoy} title="No tickets here" />
          </CardContent>
        </Card>
      );
    }
    return (
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ticket</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Raised</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-0" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((t) => (
                <TableRow key={t.id} className="cursor-pointer" onClick={() => setSelected(t)}>
                  <TableCell>
                    <div className="font-medium">{t.title}</div>
                    <div className="text-muted-foreground text-xs">{t.code}</div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="size-6 shrink-0">
                        <AvatarFallback className="text-[10px]">{employeeInitials(t.employee)}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm">{employeeFullName(t.employee)}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{TICKET_CATEGORY_LABEL[t.category]}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(t.createdAt)}</TableCell>
                  <TableCell>
                    <StatusBadge status={TICKET_STATUS_LABEL[t.status]} tone={TICKET_STATUS_TONE[t.status]} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="icon-sm" variant="ghost" aria-label="View">
                      <MessageSquare className="size-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Ticket management" description="Work every employee-raised ticket through to resolution." />

      <AsyncSection
        loading={loading}
        error={error}
        onRetry={refetch}
        loadingFallback={<StatGridSkeleton count={4} />}
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Open" value={String(open.length)} icon={AlertCircle} tone="destructive" />
          <StatCard label="Under progress" value={String(inProgress.length)} icon={Clock} tone="orange" />
          <StatCard label="Resolved" value={String(resolved.length)} icon={CheckCircle2} tone="success" />
          <StatCard label="Closed" value={String(closed.length)} icon={Archive} />
        </div>
      </AsyncSection>

      <AsyncSection
        loading={loading}
        error={error}
        onRetry={refetch}
        loadingFallback={<TableSkeleton rows={5} columns={6} />}
      >
        <Tabs value={tab} onValueChange={(v) => setTab(v as TabValue)}>
          <TabsList>
            <TabsTrigger value="ALL">All ({tickets.length})</TabsTrigger>
            <TabsTrigger value="OPEN">Open ({open.length})</TabsTrigger>
            <TabsTrigger value="IN_PROGRESS">Under progress ({inProgress.length})</TabsTrigger>
            <TabsTrigger value="RESOLVED">Resolved ({resolved.length})</TabsTrigger>
            <TabsTrigger value="CLOSED">Closed ({closed.length})</TabsTrigger>
          </TabsList>
          <TabsContent value={tab} className="mt-4">
            {renderTable(filtered)}
          </TabsContent>
        </Tabs>
      </AsyncSection>

      {selected && (
        <TicketDetailSheet
          ticket={selected}
          currentUserEmail={user.email}
          canManage
          onOpenChange={(open) => !open && setSelected(null)}
          onUpdated={(updated) => {
            setSelected(updated);
            refetch();
          }}
        />
      )}
    </div>
  );
}
