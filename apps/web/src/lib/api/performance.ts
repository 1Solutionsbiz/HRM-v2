import { apiFetch } from "@/lib/api-client";

export interface PerformanceCycle {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

export interface Goal {
  id: string;
  employeeId: string;
  cycleId: string;
  title: string;
  progressPercent: number;
  dueDate: string | null;
}

export interface PerformanceReview {
  id: string;
  employeeId: string;
  cycleId: string;
  rating: number;
  maxRating: number;
  summary: string;
  reviewedByUserId: string;
  reviewedAt: string;
  reviewedByUser: { employee: { firstName: string; lastName: string } | null };
  cycle: { name: string };
}

export interface Recognition {
  id: string;
  employeeId: string;
  title: string;
  source: string;
  awardedAt: string;
}

export interface PerformanceRecord {
  cycle: PerformanceCycle | null;
  goals: Goal[];
  lastReview: PerformanceReview | null;
  recognitions: Recognition[];
}

export function getMyPerformance(): Promise<PerformanceRecord> {
  return apiFetch<PerformanceRecord>("/performance/me");
}

export function updateMyGoalProgress(goalId: string, progressPercent: number): Promise<Goal> {
  return apiFetch<Goal>(`/performance/goals/${goalId}/progress`, {
    method: "PATCH",
    body: { progressPercent },
  });
}
