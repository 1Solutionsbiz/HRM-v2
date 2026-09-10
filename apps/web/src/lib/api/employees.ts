import { apiFetch, apiUpload } from "@/lib/api-client";

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

export type FamilyMemberKind = "CHILD" | "OTHER_DEPENDENT" | "NOMINEE";

export interface EmergencyContact {
  id: string;
  name: string;
  relationship: string;
  isdCode: string | null;
  phone: string;
}

export interface EmployeeIdentification {
  panNumber: string | null;
  aadhaarNumber: string | null;
  passportNumber: string | null;
  passportExpiryDate: string | null;
  drivingLicenseNumber: string | null;
  drivingLicenseExpiryDate: string | null;
}

export interface EmployeeFamilyDetail {
  fatherName: string | null;
  fatherDateOfBirth: string | null;
  motherName: string | null;
  motherDateOfBirth: string | null;
}

export interface EmployeeFamilyMember {
  id: string;
  kind: FamilyMemberKind;
  name: string;
  relationship: string | null;
  dateOfBirth: string | null;
  sharePercentage: number | null;
}

export interface EmployeePreviousEmployer {
  id: string;
  companyName: string;
  designation: string | null;
  fromDate: string | null;
  toDate: string | null;
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
  permanentAddress: string | null;
  employmentType: EmploymentType;
  workLocation: string | null;
  gender: Gender | null;
  nationality: string | null;
  religion: string | null;
  maritalStatus: MaritalStatus | null;
  bloodGroup: string | null;
  emergencyContacts: EmergencyContact[];
  bankDetail: {
    bankName: string;
    accountNumber: string;
    ifscCode: string;
    branch: string | null;
    city: string | null;
  } | null;
  identification: EmployeeIdentification | null;
  familyDetail: EmployeeFamilyDetail | null;
  familyMembers: EmployeeFamilyMember[];
  previousEmployers: EmployeePreviousEmployer[];
  education: EmployeeEducationEntry[];
  assets: EmployeeAssetEntry[];
  documents: EmployeeDocumentEntry[];
}

export function getEmployees(): Promise<EmployeeListItem[]> {
  return apiFetch<EmployeeListItem[]>("/employees");
}

export interface UpcomingBirthday {
  id: string;
  firstName: string;
  lastName: string;
  department: { name: string } | null;
  nextBirthday: string;
  daysUntil: number;
}

export function getUpcomingBirthdays(): Promise<UpcomingBirthday[]> {
  return apiFetch<UpcomingBirthday[]>("/employees/birthdays");
}

export function wishBirthday(employeeId: string, message: string) {
  return apiFetch(`/employees/${employeeId}/wish-birthday`, {
    method: "POST",
    body: { message },
  });
}

export interface UpcomingAnniversary {
  id: string;
  firstName: string;
  lastName: string;
  department: { name: string } | null;
  nextAnniversary: string;
  daysUntil: number;
  years: number;
}

export function getUpcomingAnniversaries(): Promise<UpcomingAnniversary[]> {
  return apiFetch<UpcomingAnniversary[]>("/employees/anniversaries");
}

export interface OnboardingStepRow {
  id: string;
  isCompleted: boolean;
  completedAt: string | null;
  stepTemplate: { id: string; name: string; sortOrder: number };
}

export function getOnboardingSteps(employeeId: string): Promise<OnboardingStepRow[]> {
  return apiFetch<OnboardingStepRow[]>(`/employees/${employeeId}/onboarding-steps`);
}

export interface OnboardingRosterEmployee {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  dateOfJoining: string;
  department: { name: string } | null;
  designation: { title: string } | null;
  onboardingSteps: OnboardingStepRow[];
}

export function getOnboardingRoster(): Promise<OnboardingRosterEmployee[]> {
  return apiFetch<OnboardingRosterEmployee[]>("/employees/onboarding");
}

export function getEmployee(id: string): Promise<EmployeeDetail> {
  return apiFetch<EmployeeDetail>(`/employees/${id}`);
}

export function getMyProfile(): Promise<EmployeeDetail> {
  return apiFetch<EmployeeDetail>("/employees/me");
}

/**
 * 8 checklist items so the result always lands on a clean multiple of
 * 12.5% - matching how this kind of "profile completeness" meter reads
 * elsewhere (a jagged percentage like "43.75%" would look like a bug).
 */
export function computeProfileCompleteness(profile: EmployeeDetail): number {
  const checks = [
    !!profile.avatarUrl,
    !!profile.phone,
    !!profile.personalEmail,
    !!profile.dateOfBirth,
    !!profile.currentAddress,
    !!profile.gender,
    profile.emergencyContacts.length > 0,
    !!profile.bankDetail,
  ];
  const completed = checks.filter(Boolean).length;
  return Math.round((completed / checks.length) * 1000) / 10;
}

export interface UpdateMyProfilePayload {
  personalEmail?: string;
  phone?: string;
  dateOfBirth?: string;
  currentAddress?: string;
  permanentAddress?: string;
  gender?: Gender;
  nationality?: string;
  religion?: string;
  maritalStatus?: MaritalStatus;
  bloodGroup?: string;
}

export function updateMyProfile(payload: UpdateMyProfilePayload): Promise<EmployeeDetail> {
  return apiFetch<EmployeeDetail>("/employees/me", { method: "PATCH", body: payload });
}

export function uploadMyAvatar(file: File): Promise<EmployeeDetail> {
  return apiUpload<EmployeeDetail>("/employees/me/avatar", file);
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

// ---------------------------------------------------------------------
// Self-service identification / family / previous-employer / emergency
// contact details — the employee edits these about themselves.
// ---------------------------------------------------------------------

export interface UpsertIdentificationPayload {
  panNumber: string;
  aadhaarNumber: string;
  passportNumber?: string;
  passportExpiryDate?: string;
  drivingLicenseNumber?: string;
  drivingLicenseExpiryDate?: string;
}

export function upsertMyIdentification(payload: UpsertIdentificationPayload): Promise<EmployeeDetail> {
  return apiFetch<EmployeeDetail>("/employees/me/identification", { method: "PUT", body: payload });
}

export interface UpsertFamilyDetailPayload {
  fatherName?: string;
  fatherDateOfBirth?: string;
  motherName?: string;
  motherDateOfBirth?: string;
}

export function upsertMyFamilyDetail(payload: UpsertFamilyDetailPayload): Promise<EmployeeDetail> {
  return apiFetch<EmployeeDetail>("/employees/me/family-detail", { method: "PUT", body: payload });
}

export interface UpsertFamilyMemberPayload {
  name: string;
  relationship?: string;
  dateOfBirth?: string;
  sharePercentage?: number;
}

const FAMILY_MEMBER_PATHS: Record<FamilyMemberKind, string> = {
  CHILD: "children",
  OTHER_DEPENDENT: "dependents",
  NOMINEE: "nominees",
};

export function addMyFamilyMember(
  kind: FamilyMemberKind,
  payload: UpsertFamilyMemberPayload,
): Promise<EmployeeDetail> {
  return apiFetch<EmployeeDetail>(`/employees/me/${FAMILY_MEMBER_PATHS[kind]}`, {
    method: "POST",
    body: payload,
  });
}

export function updateMyFamilyMember(
  kind: FamilyMemberKind,
  memberId: string,
  payload: UpsertFamilyMemberPayload,
): Promise<EmployeeDetail> {
  return apiFetch<EmployeeDetail>(`/employees/me/${FAMILY_MEMBER_PATHS[kind]}/${memberId}`, {
    method: "PATCH",
    body: payload,
  });
}

export function removeMyFamilyMember(kind: FamilyMemberKind, memberId: string): Promise<EmployeeDetail> {
  return apiFetch<EmployeeDetail>(`/employees/me/${FAMILY_MEMBER_PATHS[kind]}/${memberId}`, {
    method: "DELETE",
  });
}

export interface UpsertMyBankDetailPayload {
  bankName: string;
  /** Blank/omitted keeps the account number already on file. */
  accountNumber?: string;
  ifscCode: string;
  branch?: string;
  city?: string;
}

export function upsertMyBankDetail(payload: UpsertMyBankDetailPayload): Promise<EmployeeDetail> {
  return apiFetch<EmployeeDetail>("/employees/me/bank-detail", { method: "PUT", body: payload });
}

export interface UpsertPreviousEmployerPayload {
  companyName: string;
  designation?: string;
  fromDate?: string;
  toDate?: string;
}

export function addMyPreviousEmployer(payload: UpsertPreviousEmployerPayload): Promise<EmployeeDetail> {
  return apiFetch<EmployeeDetail>("/employees/me/previous-employers", { method: "POST", body: payload });
}

export function updateMyPreviousEmployer(
  employerId: string,
  payload: UpsertPreviousEmployerPayload,
): Promise<EmployeeDetail> {
  return apiFetch<EmployeeDetail>(`/employees/me/previous-employers/${employerId}`, {
    method: "PATCH",
    body: payload,
  });
}

export function removeMyPreviousEmployer(employerId: string): Promise<EmployeeDetail> {
  return apiFetch<EmployeeDetail>(`/employees/me/previous-employers/${employerId}`, { method: "DELETE" });
}

export interface UpsertEmergencyContactPayload {
  name: string;
  relationship: string;
  isdCode?: string;
  phone: string;
}

export function addMyEmergencyContact(payload: UpsertEmergencyContactPayload): Promise<EmployeeDetail> {
  return apiFetch<EmployeeDetail>("/employees/me/emergency-contacts", { method: "POST", body: payload });
}

export function updateMyEmergencyContact(
  contactId: string,
  payload: UpsertEmergencyContactPayload,
): Promise<EmployeeDetail> {
  return apiFetch<EmployeeDetail>(`/employees/me/emergency-contacts/${contactId}`, {
    method: "PATCH",
    body: payload,
  });
}

export function removeMyEmergencyContact(contactId: string): Promise<EmployeeDetail> {
  return apiFetch<EmployeeDetail>(`/employees/me/emergency-contacts/${contactId}`, { method: "DELETE" });
}
