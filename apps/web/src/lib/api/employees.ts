import { apiFetch } from "@/lib/api-client";

export type EmployeeStatus = "ACTIVE" | "INACTIVE";
export type EmploymentType = "FULL_TIME" | "PART_TIME" | "CONTRACT" | "INTERN";
export type Gender = "MALE" | "FEMALE" | "OTHER";
export type MaritalStatus = "SINGLE" | "MARRIED" | "DIVORCED" | "WIDOWED";
export type DocumentStatus = "VERIFIED" | "PENDING_REVIEW" | "MISSING" | "REJECTED";

export interface EmployeeManagerRef {
  id: string;
  firstName: string;
  lastName: string;
}

export interface EmployeeListItem {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  status: EmployeeStatus;
  dateOfJoining: string;
  dateOfExit: string | null;
  avatarUrl: string | null;
  user: { email: string };
  department: { id: string; name: string } | null;
  designation: { id: string; title: string } | null;
  manager: EmployeeManagerRef | null;
}

export interface EmployeeEducationEntry {
  id: string;
  institution: string;
  fieldOfStudy: string | null;
  startDate: string | null;
  endDate: string | null;
}

export interface EmployeeAssetEntry {
  id: string;
  assetTag: string;
  name: string;
  imageUrl: string | null;
  issuedDate: string;
  returnDate: string | null;
}

export interface EmployeeDocumentEntry {
  id: string;
  status: DocumentStatus;
  fileUrl: string | null;
  uploadedAt: string | null;
  documentType: { name: string; category: string };
}

export interface EmployeeDetail extends EmployeeListItem {
  user: { email: string; isActive: boolean };
  personalEmail: string | null;
  dateOfBirth: string | null;
  currentAddress: string | null;
  employmentType: EmploymentType;
  workLocation: string | null;
  gender: Gender | null;
  nationality: string | null;
  religion: string | null;
  maritalStatus: MaritalStatus | null;
  bloodGroup: string | null;
  emergencyContact: { name: string; relationship: string; phone: string } | null;
  bankDetail: {
    bankName: string;
    accountNumber: string;
    ifscCode: string;
    panNumber: string | null;
  } | null;
  education: EmployeeEducationEntry[];
  assets: EmployeeAssetEntry[];
  documents: EmployeeDocumentEntry[];
}

export function getEmployees(): Promise<EmployeeListItem[]> {
  return apiFetch<EmployeeListItem[]>("/employees");
}

export function getEmployee(id: string): Promise<EmployeeDetail> {
  return apiFetch<EmployeeDetail>(`/employees/${id}`);
}

export function getMyProfile(): Promise<EmployeeDetail> {
  return apiFetch<EmployeeDetail>("/employees/me");
}

export interface UpdateMyProfilePayload {
  personalEmail?: string;
  phone?: string;
  dateOfBirth?: string;
  currentAddress?: string;
  gender?: Gender;
  nationality?: string;
  religion?: string;
  maritalStatus?: MaritalStatus;
  bloodGroup?: string;
}

export function updateMyProfile(payload: UpdateMyProfilePayload): Promise<EmployeeDetail> {
  return apiFetch<EmployeeDetail>("/employees/me", { method: "PATCH", body: payload });
}

export function employeeFullName(e: { firstName: string; lastName: string }): string {
  return `${e.firstName} ${e.lastName}`.trim();
}

export function employeeInitials(e: { firstName: string; lastName: string }): string {
  const a = e.firstName.trim().charAt(0);
  const b = e.lastName.trim().charAt(0);
  return `${a}${b}`.toUpperCase() || "?";
}

/** Backend enums are SCREAMING_CASE; every status/enum badge in the UI expects Title Case. */
export function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}

const BLOOD_GROUP_LABELS: Record<string, string> = {
  A_POSITIVE: "A+",
  A_NEGATIVE: "A-",
  B_POSITIVE: "B+",
  B_NEGATIVE: "B-",
  AB_POSITIVE: "AB+",
  AB_NEGATIVE: "AB-",
  O_POSITIVE: "O+",
  O_NEGATIVE: "O-",
};

export function formatBloodGroup(value: string | null): string {
  if (!value) return "—";
  return BLOOD_GROUP_LABELS[value] ?? titleCase(value);
}

export function maskAccountNumber(accountNumber: string): string {
  const last4 = accountNumber.slice(-4);
  return `•••• •••• ${last4}`;
}
