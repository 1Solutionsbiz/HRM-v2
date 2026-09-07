import { apiFetch } from "@/lib/api-client";

export type TicketCategory =
  | "SALARY_OR_PAYMENT"
  | "LEAVE_OR_ATTENDANCE"
  | "OFFICE_FACILITIES"
  | "GENERAL_QUERIES"
  | "RECRUITMENT_OR_JOINING"
  | "EXIT_FORMALITIES"
  | "COMPLAINT"
  | "MISPUNCH";

export type TicketPriority = "LOW" | "MEDIUM" | "HIGH";
export type TicketStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";

/** Stable backend keys -> the labels legacy hrmpulse.com showed in its category dropdown. */
export const TICKET_CATEGORY_LABEL: Record<TicketCategory, string> = {
  SALARY_OR_PAYMENT: "Salary or Payment",
  LEAVE_OR_ATTENDANCE: "Leave or Attendance",
  OFFICE_FACILITIES: "Office Facilities",
  GENERAL_QUERIES: "General Queries",
  RECRUITMENT_OR_JOINING: "Recruitment / Joining",
  EXIT_FORMALITIES: "Exit Formalities",
  COMPLAINT: "Complaint",
  MISPUNCH: "Mispunch",
};

export const TICKET_PRIORITY_LABEL: Record<TicketPriority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
};

export const TICKET_STATUS_LABEL: Record<TicketStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "Under Progress",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

/**
 * Explicit color coding as requested (Open=red, Under Progress=orange,
 * Closed=green) - overrides StatusBadge's automatic label->tone lookup,
 * which would otherwise map "open" to info/blue and "closed" to
 * neutral/gray. RESOLVED isn't part of the 3-state request (see the
 * TicketStatus schema comment - kept for real legacy data) and shares
 * CLOSED's green since both are "done" states.
 */
export const TICKET_STATUS_TONE: Record<TicketStatus, "destructive" | "warning" | "success"> = {
  OPEN: "destructive",
  IN_PROGRESS: "warning",
  RESOLVED: "success",
  CLOSED: "success",
};

export interface TicketEmployeeRef {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
}

export interface TicketComment {
  id: string;
  ticketId: string;
  authorUserId: string;
  body: string;
  createdAt: string;
  authorUser: { id: string; email: string };
}

export interface Ticket {
  id: string;
  code: string;
  employeeId: string;
  category: TicketCategory;
  title: string;
  description: string;
  priority: TicketPriority;
  status: TicketStatus;
  resolvedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  employee: TicketEmployeeRef;
  comments: TicketComment[];
}

export interface CreateTicketPayload {
  category: TicketCategory;
  title: string;
  description: string;
  priority?: TicketPriority;
}

export function getMyTickets(): Promise<Ticket[]> {
  return apiFetch<Ticket[]>("/tickets/mine");
}

export function createTicket(payload: CreateTicketPayload): Promise<Ticket> {
  return apiFetch<Ticket>("/tickets", { method: "POST", body: payload });
}

export function getCompanyTickets(): Promise<Ticket[]> {
  return apiFetch<Ticket[]>("/tickets/company");
}

export function updateTicketStatus(id: string, status: TicketStatus): Promise<Ticket> {
  return apiFetch<Ticket>(`/tickets/${id}/status`, { method: "PATCH", body: { status } });
}

export function addTicketComment(id: string, body: string): Promise<Ticket> {
  return apiFetch<Ticket>(`/tickets/${id}/comments`, { method: "POST", body: { body } });
}
