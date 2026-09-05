import type { RequestStatus, EmployeeDocument } from "./fixtures";
import { documents as selfDocuments } from "./fixtures";

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

// ---------------------------------------------------------------------------
// Employee detail (single-employee profile screen)
// ---------------------------------------------------------------------------
// Extra fields beyond DirectoryEmployee, for the "view one employee in full"
// screen (admin/HR viewing anyone's profile) - the self-service /profile
// screen has its own richer fixture (fixtures.ts, currentEmployee) since it
// only ever needs to describe one person.
//
// EmployeeBankDetail is a real V2 model but only carries
// bankName/accountNumber/ifscCode/panNumber - no accountHolderName or branch
// field (unlike the legacy HRM), so those aren't shown here either.

export interface EmployeeBankDetail {
  bankName: string;
  accountLast4: string;
  ifscCode: string;
  panMasked: string;
}

export interface EmployeeEmergencyContact {
  name: string;
  relationship: string;
  phone: string;
}

export interface EmployeeEducationEntry {
  id: string;
  institution: string;
  fieldOfStudy: string;
  startDate: string;
  endDate?: string;
}

export interface EmployeeAsset {
  id: string;
  assetTag: string;
  name: string;
  issuedDate: string;
  returnDate?: string;
}

export interface EmployeeDetailExtra {
  personalEmail: string;
  dateOfBirth: string;
  currentAddress: string;
  employmentType: "Full-time" | "Part-time" | "Contract" | "Intern";
  workLocation: string;
  gender: "Male" | "Female" | "Other";
  nationality: string;
  religion: string;
  maritalStatus: "Single" | "Married" | "Divorced" | "Widowed";
  bloodGroup: string;
  bankDetail: EmployeeBankDetail;
  emergencyContact: EmployeeEmergencyContact;
  documents: EmployeeDocument[];
  education: EmployeeEducationEntry[];
  assets: EmployeeAsset[];
}

const DOC_ROTATIONS: EmployeeDocument["status"][][] = [
  ["Verified", "Verified", "Verified", "Verified", "Verified", "Verified"],
  ["Verified", "Verified", "Pending review", "Verified", "Verified", "Missing"],
  ["Verified", "Missing", "Verified", "Missing", "Pending review", "Missing"],
];

function documentsFor(seed: number): EmployeeDocument[] {
  const statuses = DOC_ROTATIONS[seed % DOC_ROTATIONS.length]!;
  return selfDocuments.map((doc, i) => ({
    ...doc,
    id: `${doc.id}-${seed}`,
    status: statuses[i]!,
    uploadedOn: statuses[i] === "Missing" ? undefined : doc.uploadedOn,
  }));
}

export const employeeDetails: Record<string, EmployeeDetailExtra> = {
  E1: { personalEmail: "aditi.sharma.personal@gmail.com", dateOfBirth: "1997-04-12", currentAddress: "B-204 Sunrise Apartments, Andheri West, Mumbai - 400058", employmentType: "Full-time", workLocation: "Mumbai HQ", gender: "Female", nationality: "Indian", religion: "Hindu", maritalStatus: "Single", bloodGroup: "B+", bankDetail: { bankName: "HDFC Bank", accountLast4: "4821", ifscCode: "HDFC0001234", panMasked: "AXXXX1234B" }, emergencyContact: { name: "Suresh Sharma", relationship: "Father", phone: "+91 98220 91456" }, documents: documentsFor(0), education: [{ id: "ED1-1", institution: "Mumbai University", fieldOfStudy: "B.Tech, Computer Science", startDate: "2015-07-01", endDate: "2019-05-30" }], assets: [{ id: "AS1-1", assetTag: "1SOL-LT-0118", name: "Dell Latitude 5420", issuedDate: "2024-07-16" }] },
  E2: { personalEmail: "rahul.verma.personal@gmail.com", dateOfBirth: "1991-11-02", currentAddress: "14 Green Park Extension, New Delhi - 110016", employmentType: "Full-time", workLocation: "Delhi Office", gender: "Male", nationality: "Indian", religion: "Hindu", maritalStatus: "Married", bloodGroup: "O+", bankDetail: { bankName: "ICICI Bank", accountLast4: "7734", ifscCode: "ICIC0002345", panMasked: "BXXXX2345C" }, emergencyContact: { name: "Meera Verma", relationship: "Spouse", phone: "+91 98220 92456" }, documents: documentsFor(0), education: [{ id: "ED2-1", institution: "Delhi College of Engineering", fieldOfStudy: "B.Tech, Computer Science", startDate: "2011-07-01", endDate: "2015-05-30" }, { id: "ED2-2", institution: "IIM Rohtak", fieldOfStudy: "Executive MBA", startDate: "2021-01-15", endDate: "2022-12-20" }], assets: [{ id: "AS2-1", assetTag: "1SOL-LT-0042", name: "MacBook Pro 14\"", issuedDate: "2019-03-05" }, { id: "AS2-2", assetTag: "1SOL-MN-0012", name: "Dell 27\" Monitor", issuedDate: "2022-06-10" }] },
  E3: { personalEmail: "neha.kapoor.personal@gmail.com", dateOfBirth: "1999-02-27", currentAddress: "302 Lotus Residency, Koramangala, Bengaluru - 560034", employmentType: "Full-time", workLocation: "Bengaluru Office", gender: "Female", nationality: "Indian", religion: "Hindu", maritalStatus: "Single", bloodGroup: "A+", bankDetail: { bankName: "Axis Bank", accountLast4: "5510", ifscCode: "UTIB0003456", panMasked: "CXXXX3456D" }, emergencyContact: { name: "Ramesh Kapoor", relationship: "Father", phone: "+91 98220 93456" }, documents: documentsFor(1), education: [{ id: "ED3-1", institution: "RV College of Engineering", fieldOfStudy: "B.E, Information Science", startDate: "2017-08-01", endDate: "2021-06-15" }], assets: [] },
  E4: { personalEmail: "vikram.rao.personal@gmail.com", dateOfBirth: "1994-07-19", currentAddress: "45 MG Road, Indiranagar, Bengaluru - 560038", employmentType: "Full-time", workLocation: "Bengaluru Office", gender: "Male", nationality: "Indian", religion: "Hindu", maritalStatus: "Married", bloodGroup: "B-", bankDetail: { bankName: "State Bank of India", accountLast4: "9982", ifscCode: "SBIN0004567", panMasked: "DXXXX4567E" }, emergencyContact: { name: "Lakshmi Rao", relationship: "Mother", phone: "+91 98220 94456" }, documents: documentsFor(0), education: [{ id: "ED4-1", institution: "PES University", fieldOfStudy: "B.Tech, Electronics", startDate: "2013-07-01", endDate: "2017-05-30" }], assets: [{ id: "AS4-1", assetTag: "1SOL-LT-0087", name: "Lenovo ThinkPad X1", issuedDate: "2021-06-25" }] },
  E5: { personalEmail: "sana.iqbal.personal@gmail.com", dateOfBirth: "1996-01-05", currentAddress: "17 Park View Society, Kothrud, Pune - 411038", employmentType: "Full-time", workLocation: "Remote", gender: "Female", nationality: "Indian", religion: "Muslim", maritalStatus: "Married", bloodGroup: "AB+", bankDetail: { bankName: "Kotak Mahindra Bank", accountLast4: "3390", ifscCode: "KKBK0005678", panMasked: "EXXXX5678F" }, emergencyContact: { name: "Imran Iqbal", relationship: "Spouse", phone: "+91 98220 95456" }, documents: documentsFor(2), education: [{ id: "ED5-1", institution: "Pune Institute of Computer Technology", fieldOfStudy: "B.E, Computer Engineering", startDate: "2014-07-01", endDate: "2018-05-30" }], assets: [{ id: "AS5-1", assetTag: "1SOL-LT-0155", name: "HP EliteBook 840", issuedDate: "2022-09-08" }] },
  E6: { personalEmail: "priya.nair.personal@gmail.com", dateOfBirth: "1988-09-30", currentAddress: "8 Marine Drive Apartments, Ernakulam, Kochi - 682031", employmentType: "Full-time", workLocation: "Delhi Office", gender: "Female", nationality: "Indian", religion: "Hindu", maritalStatus: "Married", bloodGroup: "O-", bankDetail: { bankName: "HDFC Bank", accountLast4: "1156", ifscCode: "HDFC0006789", panMasked: "FXXXX6789G" }, emergencyContact: { name: "Anand Nair", relationship: "Spouse", phone: "+91 98220 96456" }, documents: documentsFor(0), education: [{ id: "ED6-1", institution: "Symbiosis Institute of Business Management", fieldOfStudy: "MBA, Human Resources", startDate: "2010-07-01", endDate: "2012-05-30" }], assets: [{ id: "AS6-1", assetTag: "1SOL-LT-0021", name: "Dell Latitude 5410", issuedDate: "2018-11-15" }] },
  E7: { personalEmail: "karan.mehta.personal@gmail.com", dateOfBirth: "1985-03-14", currentAddress: "22 Civil Lines, Jaipur - 302006", employmentType: "Full-time", workLocation: "Delhi Office", gender: "Male", nationality: "Indian", religion: "Hindu", maritalStatus: "Married", bloodGroup: "A-", bankDetail: { bankName: "Punjab National Bank", accountLast4: "6623", ifscCode: "PUNB0007890", panMasked: "GXXXX7890H" }, emergencyContact: { name: "Kavita Mehta", relationship: "Spouse", phone: "+91 98220 97456" }, documents: documentsFor(0), education: [{ id: "ED7-1", institution: "Malaviya National Institute of Technology", fieldOfStudy: "B.Tech, Information Technology", startDate: "2003-07-01", endDate: "2007-05-30" }], assets: [{ id: "AS7-1", assetTag: "1SOL-LT-0004", name: "Dell Precision 5560", issuedDate: "2015-04-20" }, { id: "AS7-2", assetTag: "1SOL-PH-0004", name: "iPhone 13 (company)", issuedDate: "2022-01-10" }] },
  E8: { personalEmail: "arjun.malhotra.personal@gmail.com", dateOfBirth: "2000-06-08", currentAddress: "56 Sector 21, Noida - 201301", employmentType: "Full-time", workLocation: "Delhi Office", gender: "Male", nationality: "Indian", religion: "Sikh", maritalStatus: "Single", bloodGroup: "B+", bankDetail: { bankName: "Axis Bank", accountLast4: "4471", ifscCode: "UTIB0008901", panMasked: "HXXXX8901I" }, emergencyContact: { name: "Sunita Malhotra", relationship: "Mother", phone: "+91 98220 98456" }, documents: documentsFor(1), education: [{ id: "ED8-1", institution: "National Institute of Design", fieldOfStudy: "B.Des, Interaction Design", startDate: "2019-07-01", endDate: "2023-05-30" }], assets: [{ id: "AS8-1", assetTag: "1SOL-LT-0205", name: "MacBook Air M2", issuedDate: "2024-02-05" }] },
  E9: { personalEmail: "divya.menon.personal@gmail.com", dateOfBirth: "1993-12-21", currentAddress: "9 Palm Grove, Adyar, Chennai - 600020", employmentType: "Full-time", workLocation: "Chennai Office", gender: "Female", nationality: "Indian", religion: "Hindu", maritalStatus: "Married", bloodGroup: "O+", bankDetail: { bankName: "ICICI Bank", accountLast4: "8829", ifscCode: "ICIC0009012", panMasked: "IXXXX9012J" }, emergencyContact: { name: "Vinod Menon", relationship: "Father", phone: "+91 98220 99457" }, documents: documentsFor(0), education: [{ id: "ED9-1", institution: "Loyola College, Chennai", fieldOfStudy: "B.Com", startDate: "2010-07-01", endDate: "2013-05-30" }, { id: "ED9-2", institution: "Great Lakes Institute of Management", fieldOfStudy: "PGDM, Sales & Marketing", startDate: "2013-07-01", endDate: "2015-04-30" }], assets: [{ id: "AS9-1", assetTag: "1SOL-LT-0063", name: "HP Spectre x360", issuedDate: "2020-08-18" }, { id: "AS9-2", assetTag: "1SOL-PH-0063", name: "iPhone 12 (company)", issuedDate: "2020-08-18" }] },
  E10: { personalEmail: "rohit.bhatia.personal@gmail.com", dateOfBirth: "1995-05-17", currentAddress: "31 Model Town, Ludhiana - 141002", employmentType: "Full-time", workLocation: "Delhi Office", gender: "Male", nationality: "Indian", religion: "Hindu", maritalStatus: "Single", bloodGroup: "B+", bankDetail: { bankName: "State Bank of India", accountLast4: "2247", ifscCode: "SBIN0000123", panMasked: "JXXXX0123K" }, emergencyContact: { name: "Rekha Bhatia", relationship: "Mother", phone: "+91 98220 10457" }, documents: documentsFor(2), education: [{ id: "ED10-1", institution: "Punjab University", fieldOfStudy: "B.Com, Accounting", startDate: "2012-07-01", endDate: "2015-05-30" }], assets: [{ id: "AS10-1", assetTag: "1SOL-LT-0288", name: "Dell Vostro 3510", issuedDate: "2023-06-02", returnDate: "2026-08-20" }] },
  E11: { personalEmail: "ishita.kapoor.personal@gmail.com", dateOfBirth: "2001-10-03", currentAddress: "70 Rajouri Garden, New Delhi - 110027", employmentType: "Full-time", workLocation: "Delhi Office", gender: "Female", nationality: "Indian", religion: "Hindu", maritalStatus: "Single", bloodGroup: "A+", bankDetail: { bankName: "Yes Bank", accountLast4: "5563", ifscCode: "YESB0001234", panMasked: "KXXXX1234L" }, emergencyContact: { name: "Manoj Kapoor", relationship: "Father", phone: "+91 98220 12457" }, documents: documentsFor(2), education: [{ id: "ED11-1", institution: "Lady Shri Ram College", fieldOfStudy: "BA, Economics", startDate: "2019-07-01", endDate: "2022-05-30" }], assets: [] },
  E12: { personalEmail: "farhan.ali.personal@gmail.com", dateOfBirth: "1992-08-25", currentAddress: "12 Banjara Hills, Hyderabad - 500034", employmentType: "Full-time", workLocation: "Remote", gender: "Male", nationality: "Indian", religion: "Muslim", maritalStatus: "Married", bloodGroup: "O-", bankDetail: { bankName: "HDFC Bank", accountLast4: "7708", ifscCode: "HDFC0002346", panMasked: "LXXXX2346M" }, emergencyContact: { name: "Ayesha Ali", relationship: "Spouse", phone: "+91 98220 13457" }, documents: documentsFor(0), education: [{ id: "ED12-1", institution: "Osmania University", fieldOfStudy: "B.Tech, Computer Science", startDate: "2010-07-01", endDate: "2014-05-30" }], assets: [{ id: "AS12-1", assetTag: "1SOL-LT-0055", name: "ThinkPad T14", issuedDate: "2019-10-08" }] },
};

export type EmployeeFull = DirectoryEmployee & EmployeeDetailExtra;

export function getEmployeeFullById(id: string): EmployeeFull | undefined {
  const base = employeeDirectory.find((e) => e.id === id);
  const extra = employeeDetails[id];
  if (!base || !extra) return undefined;
  return { ...base, ...extra };
}

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
