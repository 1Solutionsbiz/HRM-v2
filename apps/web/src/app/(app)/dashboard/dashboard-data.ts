// Only the style guide's sample data table still uses this file - the
// admin/hr/manager dashboards are all wired to the real API now (see
// admin-dashboard.tsx, hr-dashboard.tsx, manager-dashboard.tsx).
export interface SampleRequest {
  id: string;
  employee: string;
  type: string;
  date: string;
  status: "Pending" | "Approved" | "Rejected";
}

export const sampleTeamRequests: SampleRequest[] = [
  { id: "1", employee: "Neha Kapoor", type: "Leave", date: "12 Nov", status: "Pending" },
  { id: "2", employee: "Aditi Sharma", type: "Expense", date: "10 Nov", status: "Pending" },
  { id: "3", employee: "Vikram Rao", type: "Leave", date: "09 Nov", status: "Approved" },
  { id: "4", employee: "Sana Iqbal", type: "Asset request", date: "08 Nov", status: "Rejected" },
];
