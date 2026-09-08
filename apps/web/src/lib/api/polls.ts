import { apiFetch } from "@/lib/api-client";

export interface PollOption {
  id: string;
  label: string;
}

export interface PollResultOption extends PollOption {
  count: number;
  percentage: number;
}

export interface PollResults {
  totalVotes: number;
  options: PollResultOption[];
}

export interface Poll {
  id: string;
  question: string;
  createdAt: string;
  endsAt: string;
  isOpen: boolean;
  hasVoted: boolean;
  myOptionId: string | null;
  options: PollOption[];
  results: PollResults | null;
}

export function getPolls(): Promise<Poll[]> {
  return apiFetch<Poll[]>("/polls");
}

export interface CreatePollPayload {
  question: string;
  endsAt: string;
  options: string[];
}

export function createPoll(payload: CreatePollPayload): Promise<Poll> {
  return apiFetch<Poll>("/polls", { method: "POST", body: payload });
}

export function votePoll(pollId: string, optionId: string) {
  return apiFetch(`/polls/${pollId}/vote`, { method: "POST", body: { optionId } });
}
