import type { RequestStatus } from "./fixtures";

/**
 * Company-wide mock data for the HR and Admin experiences - distinct from
 * fixtures.ts, which is scoped to "the current employee." HR/Admin screens
 * need to see across the whole company, not just one person's records.
 */

export const companyHeadcountSummary = {
  totalEmployees: 126,
  presentToday: 109,
  onLeaveToday: 8,
  lateToday: 6,
  pendingRequests: 13,
};

export const departments = [
  "Engineering",
  "Design",
  "Sales",
  "Marketing",
  "Finance",
  "Human Resources",
  "Operations",
] as const;

export interface DirectoryEmployee {
  id: string;
  name: string;
  empCode: string;
  email: string;
  phone: string;
  department: (typeof departments)[number];
  designation: string;
  status: "Active" | "Inactive" | "On Leave";
  doj: string;
  manager: string;
  avatarInitials: string;
}

export const employeeDirectory: DirectoryEmployee[] = [
  { id: "E1", name: "Aditi Sharma", empCode: "EXP-24-0118-OM", email: "aditi.sharma@1solutions.biz", phone: "+91 98220 11456", department: "Engineering", designation: "Software Engineer", status: "Active", doj: "2024-07-15", manager: "Rahul Verma", avatarInitials: "AS" },
  { id: "E2", name: "Rahul Verma", empCode: "EXP-19-0042-OM", email: "rahul.verma@1solutions.biz", phone: "+91 98220 22456", department: "Engineering", designation: "Engineering Manager", status: "Active", doj: "2019-03-01", manager: "Karan Mehta", avatarInitials: "RV" },
  { id: "E3", name: "Neha Kapoor", empCode: "EXP-23-0301-OM", email: "neha.kapoor@1solutions.biz", phone: "+91 98220 33456", department: "Engineering", designation: "Software Engineer", status: "Active", doj: "2023-01-10", manager: "Rahul Verma", avatarInitials: "NK" },
  { id: "E4", name: "Vikram Rao", empCode: "EXP-21-0087-OM", email: "vikram.rao@1solutions.biz", phone: "+91 98220 44456", department: "Engineering", designation: "Senior Software Engineer", status: "Active", doj: "2021-06-21", manager: "Rahul Verma", avatarInitials: "VR" },
  { id: "E5", name: "Sana Iqbal", empCode: "EXP-22-0155-OM", email: "sana.iqbal@1solutions.biz", phone: "+91 98220 55456", department: "Engineering", designation: "QA Engineer", status: "On Leave", doj: "2022-09-05", manager: "Rahul Verma", avatarInitials: "SI" },
  { id: "E6", name: "Priya Nair", empCode: "EXP-18-0021-OM", email: "priya.nair@1solutions.biz", phone: "+91 98220 66456", department: "Human Resources", designation: "HR Business Partner", status: "Active", doj: "2018-11-12", manager: "Karan Mehta", avatarInitials: "PN" },
  { id: "E7", name: "Karan Mehta", empCode: "EXP-15-0004-OM", email: "karan.mehta@1solutions.biz", phone: "+91 98220 77456", department: "Operations", designation: "System Administrator", status: "Active", doj: "2015-04-18", manager: "-", avatarInitials: "KM" },
  { id: "E8", name: "Arjun Malhotra", empCode: "EXP-24-0205-OM", email: "arjun.malhotra@1solutions.biz", phone: "+91 98220 88456", department: "Design", designation: "UI/UX Designer", status: "Active", doj: "2024-02-01", manager: "Rahul Verma", avatarInitials: "AM" },
  { id: "E9", name: "Divya Menon", empCode: "EXP-20-0063-OM", email: "divya.menon@1solutions.biz", phone: "+91 98220 99456", department: "Sales", designation: "Sales Manager", status: "Active", doj: "2020-08-14", manager: "Karan Mehta", avatarInitials: "DM" },
  { id: "E10", name: "Rohit Bhatia", empCode: "EXP-23-0288-OM", email: "rohit.bhatia@1solutions.biz", phone: "+91 98220 10456", department: "Finance", designation: "Accounts Executive", status: "Inactive", doj: "2023-05-30", manager: "Karan Mehta", avatarInitials: "RB" },
  { id: "E11", name: "Ishita Kapoor", empCode: "EXP-25-0011-OM", email: "ishita.kapoor@1solutions.biz", phone: "+91 98220 12456", department: "Marketing", designation: "Marketing Executive", status: "Active", doj: "2025-08-18", manager: "Karan Mehta", avatarInitials: "IK" },
  { id: "E12", name: "Farhan Ali", empCode: "EXP-19-0055-OM", email: "farhan.ali@1solutions.biz", phone: "+91 98220 13456", department: "Engineering", designation: "DevOps Engineer", status: "Active", doj: "2019-10-02", manager: "Rahul Verma", avatarInitials: "FA" },
];

export interface CompanyLeaveRequest {
  id: string;
  employeeName: string;
  avatarInitials: string;
  department: string;
  type: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: RequestStatus;
  submittedOn: string;
}

export const companyLeaveRequests: CompanyLeaveRequest[] = [
  { id: "CL-1", employeeName: "Neha Kapoor", avatarInitials: "NK", department: "Engineering", type: "Casual Leave", startDate: "2026-09-12", endDate: "2026-09-12", days: 1, reason: "Personal work", status: "Pending", submittedOn: "2026-09-05" },
  { id: "CL-2", employeeName: "Arjun Malhotra", avatarInitials: "AM", department: "Design", type: "Sick Leave", startDate: "2026-09-08", endDate: "2026-09-09", days: 2, reason: "Fever", status: "Pending", submittedOn: "2026-09-04" },
  { id: "CL-3", employeeName: "Divya Menon", avatarInitials: "DM", department: "Sales", type: "Earned Leave", startDate: "2026-09-20", endDate: "2026-09-24", days: 5, reason: "Family trip", status: "Pending", submittedOn: "2026-09-03" },
  { id: "CL-4", employeeName: "Vikram Rao", avatarInitials: "VR", department: "Engineering", type: "Casual Leave", startDate: "2026-09-01", endDate: "2026-09-01", days: 1, reason: "Personal work", status: "Approved", submittedOn: "2026-08-29" },
  { id: "CL-5", employeeName: "Ishita Kapoor", avatarInitials: "IK", department: "Marketing", type: "Sick Leave", startDate: "2026-08-25", endDate: "2026-08-25", days: 1, reason: "Not feeling well", status: "Rejected", submittedOn: "2026-08-24" },
];

export interface CompanyExpenseClaim {
  id: string;
  employeeName: string;
  avatarInitials: string;
  department: string;
  category: string;
  amount: number;
  description: string;
  status: RequestStatus;
  submittedOn: string;
}

export const companyExpenseClaims: CompanyExpenseClaim[] = [
  { id: "CE-1", employeeName: "Aditi Sharma", avatarInitials: "AS", department: "Engineering", category: "Travel", amount: 1450, description: "Cab fare - client visit", status: "Pending", submittedOn: "2026-09-03" },
  { id: "CE-2", employeeName: "Farhan Ali", avatarInitials: "FA", department: "Engineering", category: "Internet & Phone", amount: 999, description: "Monthly broadband", status: "Pending", submittedOn: "2026-09-02" },
  { id: "CE-3", employeeName: "Divya Menon", avatarInitials: "DM", department: "Sales", category: "Client Entertainment", amount: 3200, description: "Client dinner - Q3 renewal", status: "Pending", submittedOn: "2026-09-01" },
  { id: "CE-4", employeeName: "Ishita Kapoor", avatarInitials: "IK", department: "Marketing", category: "Office Supplies", amount: 540, description: "Event banners", status: "Approved", submittedOn: "2026-08-28" },
  { id: "CE-5", employeeName: "Rohit Bhatia", avatarInitials: "RB", department: "Finance", category: "Travel", amount: 2100, description: "Site visit - vendor audit", status: "Rejected", submittedOn: "2026-08-20" },
];

export interface NewJoiner {
  id: string;
  name: string;
  avatarInitials: string;
  designation: string;
  department: string;
  doj: string;
  onboardingProgress: number;
}

export const newJoiners: NewJoiner[] = [
  { id: "NJ-1", name: "Ishita Kapoor", avatarInitials: "IK", designation: "Marketing Executive", department: "Marketing", doj: "2026-08-18", onboardingProgress: 80 },
  { id: "NJ-2", name: "Sameer Joshi", avatarInitials: "SJ", designation: "Backend Engineer", department: "Engineering", doj: "2026-09-01", onboardingProgress: 45 },
  { id: "NJ-3", name: "Ananya Iyer", avatarInitials: "AI", designation: "Product Designer", department: "Design", doj: "2026-09-08", onboardingProgress: 10 },
];

export interface UpcomingBirthday {
  id: string;
  name: string;
  avatarInitials: string;
  department: string;
  date: string; // this year, YYYY-MM-DD
}

export const upcomingBirthdays: UpcomingBirthday[] = [
  { id: "B1", name: "Vikram Rao", avatarInitials: "VR", department: "Engineering", date: "2026-09-08" },
  { id: "B2", name: "Priya Nair", avatarInitials: "PN", department: "Human Resources", date: "2026-09-11" },
  { id: "B3", name: "Farhan Ali", avatarInitials: "FA", department: "Engineering", date: "2026-09-15" },
];

// ---------------------------------------------------------------------------
// Onboarding (detailed screen)
// ---------------------------------------------------------------------------

export interface OnboardingStep {
  name: string;
  done: boolean;
}

export interface OnboardingCandidate {
  id: string;
  name: string;
  avatarInitials: string;
  designation: string;
  department: string;
  doj: string;
  steps: OnboardingStep[];
}

export const onboardingCandidates: OnboardingCandidate[] = [
  {
    id: "NJ-1", name: "Ishita Kapoor", avatarInitials: "IK", designation: "Marketing Executive", department: "Marketing", doj: "2026-08-18",
    steps: [
      { name: "Offer letter signed", done: true },
      { name: "Documents collected", done: true },
      { name: "IT & email setup", done: true },
      { name: "Policy acknowledgment", done: true },
      { name: "Manager introduction", done: false },
    ],
  },
  {
    id: "NJ-2", name: "Sameer Joshi", avatarInitials: "SJ", designation: "Backend Engineer", department: "Engineering", doj: "2026-09-01",
    steps: [
      { name: "Offer letter signed", done: true },
      { name: "Documents collected", done: true },
      { name: "IT & email setup", done: false },
      { name: "Policy acknowledgment", done: false },
      { name: "Manager introduction", done: false },
    ],
  },
  {
    id: "NJ-3", name: "Ananya Iyer", avatarInitials: "AI", designation: "Product Designer", department: "Design", doj: "2026-09-08",
    steps: [
      { name: "Offer letter signed", done: true },
      { name: "Documents collected", done: false },
      { name: "IT & email setup", done: false },
      { name: "Policy acknowledgment", done: false },
      { name: "Manager introduction", done: false },
    ],
  },
];

// ---------------------------------------------------------------------------
// Resignations (detailed screen)
// ---------------------------------------------------------------------------

export interface ResignationRequest {
  id: string;
  employeeName: string;
  avatarInitials: string;
  designation: string;
  department: string;
  submittedOn: string;
  lastWorkingDay: string;
  noticePeriodDays: number;
  reason: string;
  status: "Pending" | "Approved" | "Declined";
}

export const resignationRequests: ResignationRequest[] = [
  { id: "R-1", employeeName: "Rohit Bhatia", avatarInitials: "RB", designation: "Accounts Executive", department: "Finance", submittedOn: "2026-08-15", lastWorkingDay: "2026-09-15", noticePeriodDays: 30, reason: "Relocating to another city", status: "Approved" },
  { id: "R-2", employeeName: "Meera Pillai", avatarInitials: "MP", designation: "Content Writer", department: "Marketing", submittedOn: "2026-09-02", lastWorkingDay: "2026-10-02", noticePeriodDays: 30, reason: "Higher studies", status: "Pending" },
];

// ---------------------------------------------------------------------------
// Salary management (detailed screen)
// ---------------------------------------------------------------------------

export interface SalaryRecord {
  employeeId: string;
  employeeName: string;
  avatarInitials: string;
  designation: string;
  department: string;
  currentSalary: number;
  lastRevision: string;
  status: "Active" | "Under review";
}

export const salaryRecords: SalaryRecord[] = employeeDirectory
  .filter((e) => e.status !== "Inactive")
  .map((e, i) => ({
    employeeId: e.id,
    employeeName: e.name,
    avatarInitials: e.avatarInitials,
    designation: e.designation,
    department: e.department,
    currentSalary: 42000 + i * 6500 + (e.designation.includes("Manager") || e.designation.includes("Senior") ? 25000 : 0),
    lastRevision: "2026-04-01",
    status: i === 2 ? "Under review" : "Active",
  }));

export const payrollMonthlyTrend = [
  { month: "Apr", cost: 6120000, headcount: 118 },
  { month: "May", cost: 6180000, headcount: 120 },
  { month: "Jun", cost: 6240000, headcount: 121 },
  { month: "Jul", cost: 6310000, headcount: 123 },
  { month: "Aug", cost: 6395000, headcount: 124 },
  { month: "Sep", cost: 6460000, headcount: 126 },
];

export const payrollByDepartment = departments.map((d, i) => ({
  department: d,
  cost: [2450000, 780000, 890000, 420000, 510000, 340000, 610000][i],
  headcount: [46, 12, 18, 9, 8, 6, 12][i],
}));

// ---------------------------------------------------------------------------
// Roles & permissions (detailed screen)
// ---------------------------------------------------------------------------

export const rolePermissions: Record<string, string[]> = {
  employee: ["View own profile, attendance, leave, payslips", "Apply for leave and expenses", "View company announcements"],
  manager: ["Everything an Employee can do", "View team attendance", "Approve/reject team leave & expense requests", "View team directory"],
  hr: ["Everything a Manager can do", "Manage the full employee directory", "Manage onboarding and resignations", "View payroll and salary records"],
  admin: ["Everything HR can do", "Manage company settings", "Assign roles and permissions", "View system and login logs"],
};

// ---------------------------------------------------------------------------
// System / audit logs (detailed screen)
// ---------------------------------------------------------------------------

export interface AuditLogEntry {
  id: string;
  actor: string;
  action: string;
  target: string;
  timestamp: string;
  ip: string;
  status: "Success" | "Failed";
}

export const auditLogs: AuditLogEntry[] = [
  { id: "L1", actor: "Aditi Sharma", action: "Login", target: "-", timestamp: "2026-09-05T06:40:00", ip: "103.21.58.12", status: "Success" },
  { id: "L2", actor: "Karan Mehta", action: "Role changed", target: "Ishita Kapoor → Employee", timestamp: "2026-09-04T11:20:00", ip: "103.21.58.40", status: "Success" },
  { id: "L3", actor: "Unknown", action: "Failed login", target: "priya.nair@1solutions.biz", timestamp: "2026-09-04T09:05:00", ip: "45.132.10.4", status: "Failed" },
  { id: "L4", actor: "Priya Nair", action: "Updated document", target: "Sana Iqbal - 12th marksheet", timestamp: "2026-09-01T14:12:00", ip: "103.21.58.22", status: "Success" },
  { id: "L5", actor: "Karan Mehta", action: "Company settings updated", target: "Support email", timestamp: "2026-08-30T16:45:00", ip: "103.21.58.40", status: "Success" },
  { id: "L6", actor: "Rahul Verma", action: "Login", target: "-", timestamp: "2026-08-30T09:12:00", ip: "103.21.58.19", status: "Success" },
];

// ---------------------------------------------------------------------------
// Company settings (detailed screen)
// ---------------------------------------------------------------------------

export interface CompanyProfile {
  name: string;
  brandName: string;
  website: string;
  supportEmail: string;
  phone: string;
  address: string;
  timezone: string;
}

export const companyProfile: CompanyProfile = {
  name: "1Solutions Pvt. Ltd.",
  brandName: "1Solutions",
  website: "https://1solutions.biz",
  supportEmail: "hr@1solutions.biz",
  phone: "+91 11 4567 8900",
  address: "F Block, Laxmi Nagar, New Delhi, Delhi 110092",
  timezone: "Asia/Kolkata (IST, UTC+5:30)",
};
