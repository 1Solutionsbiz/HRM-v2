"use client";

import * as React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Inbox,
  Info,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/hrm/page-header";
import { StatusBadge } from "@/components/hrm/status-badge";
import { EmptyState } from "@/components/hrm/empty-state";
import { ErrorState } from "@/components/hrm/error-state";
import { ConfirmDialog } from "@/components/hrm/confirm-dialog";
import { StatCard } from "@/components/hrm/stat-card";
import { ChartCard } from "@/components/hrm/chart-card";
import {
  StatGridSkeleton,
  TableSkeleton,
} from "@/components/hrm/loading-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { AttendanceTrendChart } from "../dashboard/attendance-trend-chart";
import { sampleTeamRequests, type SampleRequest } from "../dashboard/dashboard-data";

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3" id={title.toLowerCase().replace(/\s+/g, "-")}>
      <div>
        <h3 className="text-base font-semibold">{title}</h3>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
      <Card>
        <CardContent className="pt-6">{children}</CardContent>
      </Card>
    </section>
  );
}

const requestColumns: ColumnDef<SampleRequest>[] = [
  { accessorKey: "employee", header: "Employee" },
  { accessorKey: "type", header: "Type" },
  { accessorKey: "date", header: "Date" },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
];

export default function StyleGuidePage() {
  const [date, setDate] = React.useState<Date | undefined>();
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [showSkeleton, setShowSkeleton] = React.useState(false);

  return (
    <div className="space-y-8">
      <PageHeader
        title="HRM design system"
        description="Every reusable component in one place, for reference while building real modules. Nothing on this page is a real feature."
      />

      <Section title="Buttons" description="Variants and sizes.">
        <div className="flex flex-wrap items-center gap-2">
          <Button>Default</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="link">Link</Button>
          <Button disabled>Disabled</Button>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button size="xs">Extra small</Button>
          <Button size="sm">Small</Button>
          <Button size="default">Default</Button>
          <Button size="lg">Large</Button>
          <Button size="icon" aria-label="Add">
            <Plus />
          </Button>
        </div>
      </Section>

      <Section title="Inputs" description="Text inputs and labels.">
        <div className="grid max-w-sm gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="sg-name">Full name</Label>
            <Input id="sg-name" placeholder="Aditi Sharma" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sg-disabled">Disabled</Label>
            <Input id="sg-disabled" disabled placeholder="Can't edit this" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sg-invalid">Invalid</Label>
            <Input id="sg-invalid" aria-invalid defaultValue="not-an-email" />
            <p className="text-destructive text-xs">Enter a valid email address.</p>
          </div>
        </div>
      </Section>

      <Section title="Selects" description="Single-choice dropdown selection.">
        <Select defaultValue="pending">
          <SelectTrigger className="w-[220px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </Section>

      <Section title="Date pickers" description="Calendar-backed date selection.">
        <DatePicker value={date} onChange={setDate} placeholder="Select a date" />
      </Section>

      <Section title="Cards" description="Basic content cards and the StatCard composite.">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Basic card</CardTitle>
              <CardDescription>A plain content card.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm">Card body content.</CardContent>
          </Card>
          <StatCard
            label="Leave balance"
            value="8 days"
            icon={Building2}
            trend={{ value: "+2 vs last year", direction: "up" }}
          />
          <StatCard label="Open tickets" value="2" description="No change" />
        </div>
      </Section>

      <Section title="Tables" description="Plain table primitive, no sorting/pagination.">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>Aditi Sharma</TableCell>
              <TableCell>Engineering</TableCell>
              <TableCell><StatusBadge status="Active" /></TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Rahul Verma</TableCell>
              <TableCell>Engineering</TableCell>
              <TableCell><StatusBadge status="Active" /></TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Section>

      <Section title="Data tables" description="Sortable, searchable, paginated table built on TanStack Table.">
        <DataTable
          columns={requestColumns}
          data={sampleTeamRequests}
          searchColumn="employee"
          searchPlaceholder="Search by employee…"
        />
      </Section>

      <Section title="Badges" description="Generic labels.">
        <div className="flex flex-wrap gap-2">
          <Badge>Default</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="outline">Outline</Badge>
          <Badge variant="destructive">Destructive</Badge>
        </div>
      </Section>

      <Section title="Status indicators" description="The one status vocabulary every HRM module should use.">
        <div className="flex flex-wrap gap-2">
          <StatusBadge status="Approved" />
          <StatusBadge status="Pending" />
          <StatusBadge status="Rejected" />
          <StatusBadge status="Active" />
          <StatusBadge status="Inactive" />
          <StatusBadge status="Open" />
          <StatusBadge status="Closed" />
        </div>
      </Section>

      <Section title="Dialogs" description="Modal dialog for focused tasks.">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline">Open dialog</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Apply for leave</DialogTitle>
              <DialogDescription>
                This is a design-system example, not a working form.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label htmlFor="sg-leave-reason">Reason</Label>
              <Input id="sg-leave-reason" placeholder="Family event" />
            </div>
            <DialogFooter>
              <Button variant="outline">Cancel</Button>
              <Button>Submit</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Section>

      <Section title="Drawers" description="Slide-in panel for mobile menus and secondary detail views.">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline">Open drawer</Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Employee detail</SheetTitle>
              <SheetDescription>
                Drawers are used for the mobile &quot;More&quot; menu and for detail
                views that shouldn&apos;t leave the current page.
              </SheetDescription>
            </SheetHeader>
          </SheetContent>
        </Sheet>
      </Section>

      <Section title="Tabs" description="Segmented content within a page.">
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="text-muted-foreground text-sm">
            Overview content goes here.
          </TabsContent>
          <TabsContent value="history" className="text-muted-foreground text-sm">
            History content goes here.
          </TabsContent>
          <TabsContent value="documents" className="text-muted-foreground text-sm">
            Documents content goes here.
          </TabsContent>
        </Tabs>
      </Section>

      <Section title="Dropdowns" description="Contextual menus and actions.">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">Open menu</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Edit</DropdownMenuItem>
            <DropdownMenuItem>Duplicate</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive">
              <Trash2 />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </Section>

      <Section title="Toasts" description="Transient feedback for background actions.">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => toast.success("Leave request approved")}>
            Trigger success
          </Button>
          <Button variant="outline" onClick={() => toast.error("Couldn't save changes")}>
            Trigger error
          </Button>
          <Button variant="outline" onClick={() => toast.info("Payslip generated")}>
            Trigger info
          </Button>
        </div>
      </Section>

      <Section title="Alerts" description="Inline, persistent banners.">
        <div className="space-y-3">
          <Alert>
            <Info />
            <AlertTitle>Heads up</AlertTitle>
            <AlertDescription>This is a default alert.</AlertDescription>
          </Alert>
          <Alert variant="success">
            <CheckCircle2 />
            <AlertTitle>Saved</AlertTitle>
            <AlertDescription>Your changes were saved successfully.</AlertDescription>
          </Alert>
          <Alert variant="warning">
            <AlertTriangle />
            <AlertTitle>Approaching limit</AlertTitle>
            <AlertDescription>You have 1 leave day remaining this quarter.</AlertDescription>
          </Alert>
          <Alert variant="destructive">
            <AlertTriangle />
            <AlertTitle>Action required</AlertTitle>
            <AlertDescription>Your document upload failed.</AlertDescription>
          </Alert>
        </div>
      </Section>

      <Section title="Avatars" description="User identity representation.">
        <div className="flex items-center gap-3">
          <Avatar>
            <AvatarFallback>AS</AvatarFallback>
          </Avatar>
          <Avatar className="size-10">
            <AvatarFallback>RV</AvatarFallback>
          </Avatar>
          <Avatar className="size-12">
            <AvatarFallback>PN</AvatarFallback>
          </Avatar>
        </div>
      </Section>

      <Section title="Progress indicators" description="Determinate progress.">
        <div className="max-w-sm space-y-4">
          <Progress value={33} />
          <Progress value={66} />
          <Progress value={90} />
        </div>
      </Section>

      <Section title="Charts" description="Recharts wrapped with the shared theme tokens.">
        <ChartCard title="Sample attendance" description="Illustrative data only.">
          <AttendanceTrendChart
            data={[
              { day: "Mon", present: 6, onLeave: 1 },
              { day: "Tue", present: 7, onLeave: 0 },
              { day: "Wed", present: 5, onLeave: 2 },
              { day: "Thu", present: 7, onLeave: 0 },
              { day: "Fri", present: 6, onLeave: 1 },
            ]}
          />
        </ChartCard>
      </Section>

      <Section title="Empty states" description="No-data placeholder, used across every module until data exists.">
        <EmptyState
          icon={Inbox}
          title="No requests yet"
          description="When employees submit requests, they'll show up here."
          action={<Button size="sm">New request</Button>}
        />
      </Section>

      <Section title="Loading states" description="Skeletons matching the shape of the content they replace.">
        <div className="space-y-4">
          <Button variant="outline" size="sm" onClick={() => setShowSkeleton((s) => !s)}>
            Toggle skeletons
          </Button>
          {showSkeleton && (
            <div className="space-y-6">
              <StatGridSkeleton count={3} />
              <TableSkeleton rows={3} columns={4} />
            </div>
          )}
        </div>
      </Section>

      <Section title="Error states" description="Failed data fetches, with a retry action.">
        <ErrorState onRetry={() => toast.info("Retrying…")} />
      </Section>

      <Section title="Confirmation dialogs" description="The one 'are you sure?' pattern for destructive or irreversible actions.">
        <Button variant="destructive" onClick={() => setConfirmOpen(true)}>
          <Trash2 />
          Delete document
        </Button>
        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title="Delete this document?"
          description="This can't be undone. The document will be permanently removed."
          confirmLabel="Delete"
          variant="destructive"
          onConfirm={() => {
            toast.success("Document deleted (preview only)");
          }}
        />
      </Section>
    </div>
  );
}
