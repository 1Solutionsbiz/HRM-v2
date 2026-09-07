"use client";

import * as React from "react";
import { LifeBuoy, Plus, MessageSquare } from "lucide-react";
import { useAuthenticatedUser } from "@/lib/auth-context";
import { useAsync } from "@/lib/use-async";
import { getMyTickets, TICKET_CATEGORY_LABEL, TICKET_STATUS_LABEL, TICKET_STATUS_TONE, type Ticket } from "@/lib/api/tickets";
import { formatDate } from "@/lib/format";
import { PageHeader } from "@/components/hrm/page-header";
import { AsyncSection } from "@/components/hrm/async-section";
import { EmptyState } from "@/components/hrm/empty-state";
import { TableSkeleton } from "@/components/hrm/loading-state";
import { StatusBadge } from "@/components/hrm/status-badge";
import { RaiseTicketDialog } from "@/components/hrm/raise-ticket-dialog";
import { TicketDetailSheet } from "@/components/hrm/ticket-detail-sheet";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function SupportPage() {
  const user = useAuthenticatedUser();
  const { data, loading, error, refetch } = useAsync(getMyTickets);
  const [selected, setSelected] = React.useState<Ticket | null>(null);
  const tickets = data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Help & support"
        description="Raise a ticket for HR to work on, and track it through to resolution."
        actions={
          <RaiseTicketDialog
            onCreated={refetch}
            trigger={
              <Button size="sm">
                <Plus />
                Raise a ticket
              </Button>
            }
          />
        }
      />

      <AsyncSection
        loading={loading}
        error={error}
        onRetry={refetch}
        loadingFallback={<TableSkeleton rows={4} columns={5} />}
      >
        {tickets.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <EmptyState
                icon={LifeBuoy}
                title="No tickets raised yet"
                description="Raise a ticket if you run into an issue with attendance, payroll, or anything else."
              />
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ticket</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Raised</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-0" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tickets.map((t) => (
                    <TableRow
                      key={t.id}
                      className="cursor-pointer"
                      onClick={() => setSelected(t)}
                    >
                      <TableCell>
                        <div className="font-medium">{t.title}</div>
                        <div className="text-muted-foreground text-xs">{t.code}</div>
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
        )}
      </AsyncSection>

      {selected && (
        <TicketDetailSheet
          ticket={selected}
          currentUserEmail={user.email}
          canManage={false}
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
