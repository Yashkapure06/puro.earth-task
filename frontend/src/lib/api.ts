import type { ApiError } from "../types/api";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

/** API error with a `code` the statement UI can map. Not a generic Error. */
export class ApiRequestError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(status: number, body: ApiError) {
    super(body.error.message);
    this.name = "ApiRequestError";
    this.code = body.error.code;
    this.status = status;
  }
}

/**
 * Same-origin `/api` via the Vite proxy unless `VITE_API_URL` is set.
 * `credentials: "include"` sends the session cookie.
 */
export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body != null && init.body !== "" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: "include",
    headers,
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const data: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const body = data as ApiError | null;
    throw new ApiRequestError(
      response.status,
      body ?? {
        error: { code: "INTERNAL_ERROR", message: "Request failed" },
      },
    );
  }

  return data as T;
}
