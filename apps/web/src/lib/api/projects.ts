import { apiFetch } from "@/lib/api-client";

export interface Project {
  id: string;
  name: string;
  isActive: boolean;
}

export function getProjects(): Promise<Project[]> {
  return apiFetch<Project[]>("/projects");
}

export interface ProjectPayload {
  name?: string;
  isActive?: boolean;
}

export function createProject(payload: { name: string }): Promise<Project> {
  return apiFetch<Project>("/projects", { method: "POST", body: payload });
}

export function updateProject(id: string, payload: ProjectPayload): Promise<Project> {
  return apiFetch<Project>(`/projects/${id}`, { method: "PATCH", body: payload });
}

export function deleteProject(id: string): Promise<void> {
  return apiFetch<void>(`/projects/${id}`, { method: "DELETE" });
}
