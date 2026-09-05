"use client";

import * as React from "react";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { currentEmployee } from "@/lib/mock/fixtures";
import { formatDate } from "@/lib/format";
import { PageHeader } from "@/components/hrm/page-header";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}

export default function ProfilePage() {
  const [phone, setPhone] = React.useState(currentEmployee.phone);
  const [address, setAddress] = React.useState(currentEmployee.currentAddress);
  const [editOpen, setEditOpen] = React.useState(false);
  const [draftPhone, setDraftPhone] = React.useState(phone);
  const [draftAddress, setDraftAddress] = React.useState(address);
  const [saving, setSaving] = React.useState(false);

  function openEdit() {
    setDraftPhone(phone);
    setDraftAddress(address);
    setEditOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 500));
    setPhone(draftPhone);
    setAddress(draftAddress);
    setSaving(false);
    setEditOpen(false);
    toast.success("Contact details updated");
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Profile" description="Your personal and employment information." />

      <Card>
        <CardContent className="flex flex-col items-center gap-3 pt-6 text-center sm:flex-row sm:text-left">
          <Avatar className="size-16">
            <AvatarFallback className="text-lg">{currentEmployee.avatarInitials}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <p className="text-lg font-semibold">{currentEmployee.name}</p>
            <p className="text-muted-foreground text-sm">
              {currentEmployee.designation} · {currentEmployee.department}
            </p>
            <p className="text-muted-foreground text-xs">{currentEmployee.empCode}</p>
          </div>
          <Button variant="outline" size="sm" onClick={openEdit}>
            <Pencil />
            Edit contact info
          </Button>
        </CardContent>
      </Card>

      <Tabs defaultValue="personal">
        <TabsList>
          <TabsTrigger value="personal">Personal</TabsTrigger>
          <TabsTrigger value="employment">Employment</TabsTrigger>
          <TabsTrigger value="bank">Bank & emergency</TabsTrigger>
        </TabsList>

        <TabsContent value="personal" className="mt-4">
          <Card>
            <CardContent className="grid gap-4 pt-6 sm:grid-cols-2">
              <Field label="Full name" value={currentEmployee.name} />
              <Field label="Work email" value={currentEmployee.email} />
              <Field label="Phone" value={phone} />
              <Field label="Current address" value={address} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="employment" className="mt-4">
          <Card>
            <CardContent className="grid gap-4 pt-6 sm:grid-cols-2">
              <Field label="Employee code" value={currentEmployee.empCode} />
              <Field label="Designation" value={currentEmployee.designation} />
              <Field label="Department" value={currentEmployee.department} />
              <Field label="Reporting manager" value={currentEmployee.manager} />
              <Field label="Date of joining" value={formatDate(currentEmployee.doj)} />
              <Field label="Employment type" value={currentEmployee.employeeType} />
              <Field label="Work location" value={currentEmployee.workLocation} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bank" className="mt-4">
          <Card>
            <CardContent className="grid gap-4 pt-6 sm:grid-cols-2">
              <Field label="Bank" value={currentEmployee.bankName} />
              <Field label="Account number" value={`•••• •••• ${currentEmployee.bankLast4}`} />
              <Field label="Emergency contact" value={currentEmployee.emergencyContact.name} />
              <Field
                label="Relationship / phone"
                value={`${currentEmployee.emergencyContact.relationship} · ${currentEmployee.emergencyContact.phone}`}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit contact info</DialogTitle>
            <DialogDescription>
              Other fields (bank, employment) need HR approval and aren&apos;t editable here.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-phone">Phone</Label>
              <Input id="edit-phone" value={draftPhone} onChange={(e) => setDraftPhone(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-address">Current address</Label>
              <Input id="edit-address" value={draftAddress} onChange={(e) => setDraftAddress(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
