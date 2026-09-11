const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

const ACCESS_TOKEN_KEY = "hrm-v2:access-token";
const REFRESH_TOKEN_KEY = "hrm-v2:refresh-token";

interface StoredTokens {
  accessToken: string;
  refreshToken: string;
}

function getStoredTokens(): StoredTokens | null {
  try {
    const accessToken = window.localStorage.getItem(ACCESS_TOKEN_KEY);
    const refreshToken = window.localStorage.getItem(REFRESH_TOKEN_KEY);
    if (!accessToken || !refreshToken) return null;
    return { accessToken, refreshToken };
  } catch {
    return null;
  }
}

function storeTokens(tokens: StoredTokens): void {
  try {
    window.localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
    window.localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
  } catch {
    // localStorage unavailable (private browsing, etc.) - the session just
    // won't persist across reloads.
  }
}

function clearTokens(): void {
  try {
    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
    window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  } catch {
    // ignore
  }
}

export const tokenStorage = { getStoredTokens, storeTokens, clearTokens };

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * The backend rotates and revokes the refresh token on every use (see
 * AuthService.refresh) — a stolen-and-replayed old token can never mint a
 * second session. That also means if several requests hit a 401 at the same
 * moment (a burst of components fetching right as the access token
 * expires), each independently calling /auth/refresh would have only the
 * first succeed; the rest would present an already-revoked token and get
 * logged out. Concurrent callers instead await this single in-flight
 * promise rather than racing separate refresh calls.
 */
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const tokens = getStoredTokens();
    if (!tokens) return null;
    try {
      const response = await fetch(`${API_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: tokens.refreshToken }),
      });
      if (!response.ok) {
        clearTokens();
        return null;
      }
      const body = (await response.json()) as StoredTokens;
      storeTokens(body);
      return body.accessToken;
    } catch {
      clearTokens();
      return null;
    }
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

/**
 * Not a React context consumer (this module has no framework dependency),
 * so a failed session is signaled via a window event rather than a direct
 * call into AuthProvider — it's the one listening.
 */
function dispatchSessionExpired(): void {
  window.dispatchEvent(new Event("hrm:session-expired"));
}

interface ApiFetchOptions {
  method?: string;
  body?: unknown;
  /** Skip attaching the access token and skip the refresh-and-retry path on 401 — for /auth/login and /auth/refresh themselves, where a 401 means "wrong credentials"/"invalid token," not "needs a refresh." */
  skipAuth?: boolean;
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: string | string[] };
    if (Array.isArray(body.message)) return body.message.join(", ");
    if (typeof body.message === "string") return body.message;
  } catch {
    // non-JSON error body
  }
  return `Request failed (${response.status})`;
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { method = "GET", body, skipAuth = false } = options;

  async function attempt(): Promise<Response> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (!skipAuth) {
      const tokens = getStoredTokens();
      if (tokens) headers.Authorization = `Bearer ${tokens.accessToken}`;
    }
    return fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  let response = await attempt();

  if (response.status === 401 && !skipAuth) {
    const newAccessToken = await refreshAccessToken();
    if (!newAccessToken) {
      dispatchSessionExpired();
      throw new ApiError(401, "Your session has expired. Please sign in again.");
    }
    response = await attempt();
  }

  if (!response.ok) {
    const message = await readErrorMessage(response);
    if (response.status === 401 && !skipAuth) dispatchSessionExpired();
    throw new ApiError(response.status, message);
  }

  if (response.status === 204) return undefined as T;
  // NestJS sends an empty body (not the text "null") when a controller
  // returns null/undefined - response.json() throws on that, so check text first.
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/**
 * Same auth-attach/401-refresh-retry behavior as apiFetch, but for a file
 * upload - deliberately not folded into apiFetch itself, since that always
 * JSON.stringifies `body` and sets Content-Type: application/json, which
 * would corrupt a multipart request. No explicit Content-Type header here:
 * the browser sets the multipart boundary itself from the FormData body.
 */
export async function apiUpload<T>(path: string, file: File): Promise<T> {
  async function attempt(): Promise<Response> {
    const headers: Record<string, string> = {};
    const tokens = getStoredTokens();
    if (tokens) headers.Authorization = `Bearer ${tokens.accessToken}`;
    const formData = new FormData();
    formData.append("file", file);
    return fetch(`${API_URL}${path}`, { method: "POST", headers, body: formData });
  }

  let response = await attempt();

  if (response.status === 401) {
    const newAccessToken = await refreshAccessToken();
    if (!newAccessToken) {
      dispatchSessionExpired();
      throw new ApiError(401, "Your session has expired. Please sign in again.");
    }
    response = await attempt();
  }

  if (!response.ok) {
    const message = await readErrorMessage(response);
    if (response.status === 401) dispatchSessionExpired();
    throw new ApiError(response.status, message);
  }

  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/**
 * Same auth-attach/401-refresh-retry behavior as apiFetch, but returns the
 * raw response body as a Blob instead of JSON-parsing it - for a real
 * authenticated binary download (letters/:id/download), not the
 * @Public()-unguessable-filename pattern other file routes use, which the
 * browser can just load directly via <a href>/<img src> with no auth header.
 */
export async function apiDownload(path: string): Promise<Blob> {
  async function attempt(): Promise<Response> {
    const headers: Record<string, string> = {};
    const tokens = getStoredTokens();
    if (tokens) headers.Authorization = `Bearer ${tokens.accessToken}`;
    return fetch(`${API_URL}${path}`, { headers });
  }

  let response = await attempt();

  if (response.status === 401) {
    const newAccessToken = await refreshAccessToken();
    if (!newAccessToken) {
      dispatchSessionExpired();
      throw new ApiError(401, "Your session has expired. Please sign in again.");
    }
    response = await attempt();
  }

  if (!response.ok) {
    const message = await readErrorMessage(response);
    if (response.status === 401) dispatchSessionExpired();
    throw new ApiError(response.status, message);
  }

  return response.blob();
}
