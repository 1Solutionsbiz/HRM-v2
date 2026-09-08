import { apiFetch } from "@/lib/api-client";

export type MoodLevel = "TERRIBLE" | "POOR" | "GOOD" | "GREAT" | "EXCELLENT";

export const MOOD_TAGS = [
  "Appraisal Salary",
  "Appreciation",
  "Colleagues",
  "Employee engagement",
  "Extracurricular activities",
  "Facilities",
  "Growth",
  "Learning opportunity",
  "Management",
  "Other",
  "Reporting Manager",
  "Work environment",
  "Work timings",
  "Work-life balance",
] as const;

export const MOOD_OPTIONS: { value: MoodLevel; label: string; emoji: string }[] = [
  { value: "TERRIBLE", label: "Terrible", emoji: "😢" },
  { value: "POOR", label: "Poor", emoji: "🙁" },
  { value: "GOOD", label: "Good", emoji: "🙂" },
  { value: "GREAT", label: "Great", emoji: "😄" },
  { value: "EXCELLENT", label: "Excellent", emoji: "🥰" },
];

export interface MoodCheckInStatus {
  handledToday: boolean;
}

export function getMoodCheckInStatus(): Promise<MoodCheckInStatus> {
  return apiFetch<MoodCheckInStatus>("/mood-checkins/status");
}

export interface SubmitMoodCheckInPayload {
  mood: MoodLevel;
  tags?: string[];
  comment?: string;
  isAnonymous?: boolean;
}

export function submitMoodCheckIn(payload: SubmitMoodCheckInPayload) {
  return apiFetch("/mood-checkins", { method: "POST", body: payload });
}

export function dismissMoodCheckIn() {
  return apiFetch("/mood-checkins/dismiss", { method: "POST" });
}

export interface MoodCheckInEntry {
  id: string;
  date: string;
  mood: MoodLevel;
  tags: string[];
  comment: string | null;
  isAnonymous: boolean;
  createdAt: string;
}

export function getMyMoodCheckIns(): Promise<MoodCheckInEntry[]> {
  return apiFetch<MoodCheckInEntry[]>("/mood-checkins/mine");
}
