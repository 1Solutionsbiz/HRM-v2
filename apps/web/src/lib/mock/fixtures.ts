/**
 * Static mock data for the employee experience. Every screen reads through
 * mock-api.ts (which simulates network delay/errors) rather than importing
 * this directly, so screens exercise real loading/error states even though
 * there is no backend yet.
 */

export const currentEmployee = {
  id: 1,
  empCode: "EXP-24-0118-OM",
  name: "Aditi Sharma",
  firstName: "Aditi",
  email: "aditi.sharma@1solutions.biz",
  phone: "+91 98220 11456",
  designation: "Software Engineer",
  department: "Engineering",
  manager: "Rahul Verma",
  doj: "2024-07-15",
  employeeType: "Full Time",
  workLocation: "Registered Office",
  currentAddress: "F Block, Laxmi Nagar, New Delhi, Delhi 110092",
  bankLast4: "4821",
  bankName: "HDFC Bank",
  emergencyContact: { name: "Rohit Sharma", relationship: "Spouse", phone: "+91 98220 55123" },
  avatarInitials: "AS",
};

export type AttendanceStatus =
  | "Present"
  | "Late"
  | "Half Day"
  | "Absent"
  | "On Leave"
  | "Holiday"
  | "Weekend";

export interface AttendanceDay {
  date: string; // YYYY-MM-DD
  status: AttendanceStatus;
  checkIn?: string; // HH:mm
  checkOut?: string;
  hours?: number;
}

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

/** Deterministically generates the last `days` calendar days of attendance, ending today. */
function generateHistory(days: number): AttendanceDay[] {
  const out: AttendanceDay[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const dow = d.getDay(); // 0 Sun .. 6 Sat

    if (dow === 0 || dow === 6) {
      out.push({ date: dateStr, status: "Weekend" });
      continue;
    }
    // A handful of fixed, realistic exceptions rather than randomizing every render.
    const bucket = i % 11;
    if (bucket === 4) {
      out.push({ date: dateStr, status: "On Leave" });
    } else if (bucket === 7) {
      out.push({ date: dateStr, status: "Late", checkIn: "10:12", checkOut: "19:05", hours: 8.9 });
    } else if (bucket === 9) {
      out.push({ date: dateStr, status: "Half Day", checkIn: "09:58", checkOut: "14:30", hours: 4.5 });
    } else if (i === 2) {
      out.push({ date: dateStr, status: "Absent" });
    } else {
      out.push({ date: dateStr, status: "Present", checkIn: "09:24", checkOut: "18:47", hours: 9.4 });
    }
  }
  return out;
}

export const attendanceHistory: AttendanceDay[] = generateHistory(45);

export const officeTiming = {
  loginTime: "09:30",
  logoutTime: "18:30",
  relaxationMinutes: 15,
  fullDayHours: 9,
  halfDayHours: 4.5,
};

export interface LeaveBalance {
  type: string;
  used: number;
  total: number;
}

export const leaveBalances: LeaveBalance[] = [
  { type: "Casual Leave", used: 4, total: 12 },
  { type: "Sick Leave", used: 3, total: 6 },
  { type: "Earned Leave", used: 5, total: 15 },
];

export type RequestStatus = "Pending" | "Approved" | "Rejected" | "Cancelled";

export interface LeaveRequest {
  id: string;
  type: string;
  startDate: string;
  endDate: string;
  days: number;
  dayType: "Full Day" | "Half Day";
  reason: string;
  status: RequestStatus;
  appliedOn: string;
  approver: string;
}

export const leaveRequests: LeaveRequest[] = [
  {
    id: "LV-1042",
    type: "Casual Leave",
    startDate: "2026-09-14",
    endDate: "2026-09-14",
    days: 1,
    dayType: "Full Day",
    reason: "Family function",
    status: "Pending",
    appliedOn: "2026-09-05",
    approver: "Rahul Verma",
  },
  {
    id: "LV-1031",
    type: "Sick Leave",
    startDate: "2026-08-19",
    endDate: "2026-08-20",
    days: 2,
    dayType: "Full Day",
    reason: "Fever",
    status: "Approved",
    appliedOn: "2026-08-19",
    approver: "Rahul Verma",
  },
  {
    id: "LV-0998",
    type: "Casual Leave",
    startDate: "2026-07-03",
    endDate: "2026-07-03",
    days: 1,
    dayType: "Half Day",
    reason: "Personal work",
    status: "Rejected",
    appliedOn: "2026-06-30",
    approver: "Rahul Verma",
  },
];

export const leaveTypes = ["Casual Leave", "Sick Leave", "Earned Leave"] as const;

export interface ExpenseClaim {
  id: string;
  category: string;
  amount: number;
  date: string;
  description: string;
  status: RequestStatus;
  receiptName?: string;
  submittedOn: string;
}

export const expenseCategories = [
  "Travel",
  "Food",
  "Internet & Phone",
  "Office Supplies",
  "Client Entertainment",
  "Other",
] as const;

export const expenseClaims: ExpenseClaim[] = [
  {
    id: "EX-3311",
    category: "Travel",
    amount: 1450,
    date: "2026-09-02",
    description: "Cab fare - client visit, Gurugram",
    status: "Pending",
    receiptName: "cab-receipt-sep2.pdf",
    submittedOn: "2026-09-03",
  },
  {
    id: "EX-3288",
    category: "Internet & Phone",
    amount: 999,
    date: "2026-08-31",
    description: "Monthly broadband reimbursement",
    status: "Approved",
    receiptName: "broadband-aug.pdf",
    submittedOn: "2026-08-31",
  },
  {
    id: "EX-3240",
    category: "Food",
    amount: 620,
    date: "2026-08-14",
    description: "Team lunch - sprint completion",
    status: "Approved",
    receiptName: "lunch-receipt.jpg",
    submittedOn: "2026-08-15",
  },
  {
    id: "EX-3199",
    category: "Office Supplies",
    amount: 340,
    date: "2026-07-28",
    description: "Notebook and stationery",
    status: "Rejected",
    submittedOn: "2026-07-29",
  },
];

export interface Payslip {
  id: string;
  month: string;
  year: number;
  gross: number;
  netPay: number;
  status: "Paid" | "Processing";
  paidOn?: string;
  earnings: { label: string; amount: number }[];
  deductions: { label: string; amount: number }[];
}

function buildPayslip(month: string, year: number, id: string, paidOn?: string): Payslip {
  const basic = 42000;
  const hra = 16800;
  const special = 12200;
  const gross = basic + hra + special;
  const pf = 5040;
  const tax = 3200;
  const gross_deduction = pf + tax;
  return {
    id,
    month,
    year,
    gross,
    netPay: gross - gross_deduction,
    status: paidOn ? "Paid" : "Processing",
    paidOn,
    earnings: [
      { label: "Basic", amount: basic },
      { label: "HRA", amount: hra },
      { label: "Special allowance", amount: special },
    ],
    deductions: [
      { label: "Provident fund", amount: pf },
      { label: "Income tax (TDS)", amount: tax },
    ],
  };
}

export const payslips: Payslip[] = [
  buildPayslip("October", 2026, "PS-2026-10", "2026-10-31"),
  buildPayslip("September", 2026, "PS-2026-09", "2026-09-30"),
  buildPayslip("August", 2026, "PS-2026-08", "2026-08-31"),
  buildPayslip("July", 2026, "PS-2026-07", "2026-07-31"),
];

export interface EmployeeDocument {
  id: string;
  name: string;
  category: string;
  status: "Verified" | "Pending review" | "Missing";
  fileName?: string;
  uploadedOn?: string;
}

export const documents: EmployeeDocument[] = [
  { id: "DOC-1", name: "Aadhaar card", category: "Identity", status: "Verified", fileName: "aadhaar.pdf", uploadedOn: "2024-07-16" },
  { id: "DOC-2", name: "PAN card", category: "Identity", status: "Verified", fileName: "pan.pdf", uploadedOn: "2024-07-16" },
  { id: "DOC-3", name: "10th marksheet", category: "Education", status: "Verified", fileName: "10th-marksheet.pdf", uploadedOn: "2024-07-18" },
  { id: "DOC-4", name: "12th marksheet", category: "Education", status: "Pending review", fileName: "12th-marksheet.pdf", uploadedOn: "2026-09-01" },
  { id: "DOC-5", name: "Bank passbook / cancelled cheque", category: "Banking", status: "Verified", fileName: "bank-proof.pdf", uploadedOn: "2024-07-20" },
  { id: "DOC-6", name: "Relieving letter (previous employer)", category: "Employment", status: "Missing" },
];

export interface Goal {
  id: string;
  title: string;
  progress: number;
  dueLabel: string;
}

export const performance = {
  cycle: { name: "H2 2026 Review Cycle", endsOn: "2026-12-15" },
  goals: [
    { id: "G1", title: "Ship HRM V2 employee module", progress: 65, dueLabel: "Due Nov 30" },
    { id: "G2", title: "Complete AWS certification", progress: 30, dueLabel: "Due Dec 15" },
    { id: "G3", title: "Mentor 2 junior engineers", progress: 80, dueLabel: "Due Dec 15" },
  ] as Goal[],
  lastReview: {
    cycle: "H1 2026",
    rating: 4.2,
    outOf: 5,
    summary: "Consistently strong delivery and good ownership of the attendance module rollout. Focus area: proactive cross-team communication.",
    reviewedBy: "Rahul Verma",
    date: "2026-06-20",
  },
  recognitions: [
    { title: "Employee of the Month - March 2026", from: "Peer nomination", date: "2026-04-02" },
    { title: "Kudos for on-call support", from: "Priya Nair", date: "2026-08-11" },
  ],
};

export interface Announcement {
  id: string;
  title: string;
  body: string;
  category: "Holiday" | "Policy" | "Event" | "General";
  publishedAt: string;
  read: boolean;
}

export const announcements: Announcement[] = [
  {
    id: "AN-1",
    title: "Diwali holiday schedule",
    body: "The office will remain closed on Nov 12 and 13 for Diwali. Regular working hours resume Nov 14. Please plan client communication accordingly.",
    category: "Holiday",
    publishedAt: "2026-09-03T10:00:00",
    read: false,
  },
  {
    id: "AN-2",
    title: "New expense reimbursement policy",
    body: "Effective this month, the monthly internet/phone reimbursement cap has been revised to ₹5,000. Submit claims with an itemised bill.",
    category: "Policy",
    publishedAt: "2026-09-02T09:00:00",
    read: false,
  },
  {
    id: "AN-3",
    title: "Town hall - Q3 results",
    body: "Join the all-hands town hall this Friday at 4:30 PM in the main conference room / on the company Meet link to hear Q3 results and the Q4 roadmap.",
    category: "Event",
    publishedAt: "2026-08-28T12:00:00",
    read: true,
  },
  {
    id: "AN-4",
    title: "Annual health checkup camp",
    body: "The annual health checkup camp is scheduled for Sept 20. Sign up with HR by Sept 15 to reserve a slot.",
    category: "General",
    publishedAt: "2026-08-20T09:30:00",
    read: true,
  },
];

export interface AppNotification {
  id: string;
  title: string;
  description: string;
  type: "leave" | "expense" | "attendance" | "announcement" | "system";
  createdAt: string;
  read: boolean;
  href?: string;
}

export const notifications: AppNotification[] = [
  {
    id: "N1",
    title: "Leave request pending",
    description: "Your Casual Leave for Sep 14 is awaiting Rahul Verma's approval.",
    type: "leave",
    createdAt: "2026-09-05T09:10:00",
    read: false,
    href: "/leave",
  },
  {
    id: "N2",
    title: "Expense approved",
    description: "Your ₹999 internet reimbursement claim was approved.",
    type: "expense",
    createdAt: "2026-09-04T15:40:00",
    read: false,
    href: "/expenses",
  },
  {
    id: "N3",
    title: "Missed check-out yesterday",
    description: "We didn't see a check-out for Sep 3. Update it if this looks wrong.",
    type: "attendance",
    createdAt: "2026-09-04T09:00:00",
    read: true,
    href: "/attendance",
  },
  {
    id: "N4",
    title: "New announcement",
    description: "Diwali holiday schedule has been published.",
    type: "announcement",
    createdAt: "2026-09-03T10:05:00",
    read: true,
    href: "/announcements",
  },
];

export interface TaskItem {
  id: string;
  title: string;
  dueLabel: string;
  done: boolean;
}

export const todaysTasks: TaskItem[] = [
  { id: "T1", title: "Submit October expense report", dueLabel: "Due today", done: false },
  { id: "T2", title: "Complete Q3 self-assessment form", dueLabel: "Due in 3 days", done: false },
  { id: "T3", title: "Acknowledge updated WFH policy", dueLabel: "Due in 5 days", done: true },
];

export interface MeetingItem {
  id: string;
  title: string;
  time: string;
  withWhom: string;
  mode: "In-person" | "Video call";
}

export const todaysMeetings: MeetingItem[] = [
  { id: "M1", title: "Sprint standup", time: "10:00 AM", withWhom: "Engineering team", mode: "Video call" },
  { id: "M2", title: "1:1 with manager", time: "3:00 PM", withWhom: "Rahul Verma", mode: "In-person" },
];
