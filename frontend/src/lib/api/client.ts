/**
 * The single door to the clinic API. Every request carries the signed-in
 * session's bearer token, and every failure arrives as an ApiError whose
 * message is safe to show at the counter.
 */

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/**
 * Set once the session is known. Reading the token through a getter rather than
 * importing the store keeps this module free of a cycle: the store imports the
 * API, not the other way round.
 */
let tokenReader: () => string | null = () => null;

export function setTokenReader(reader: () => string | null) {
  tokenReader = reader;
}

/** Called when the API rejects the token, so the app can send the user back to sign in. */
let onUnauthenticated: () => void = () => {};

export function setUnauthenticatedHandler(handler: () => void) {
  onUnauthenticated = handler;
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  /** Skips the sign-out handler — used by login itself. */
  anonymous?: boolean;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, anonymous = false } = options;
  const token = anonymous ? null : tokenReader();

  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError("Cannot reach the clinic server. Check that the API is running.", 0);
  }

  if (response.status === 401 && !anonymous) {
    onUnauthenticated();
    throw new ApiError("Your session has expired. Please sign in again.", 401);
  }

  if (!response.ok) {
    throw new ApiError(await errorMessage(response), response.status);
  }

  if (response.status === 204) return undefined as T;
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

async function errorMessage(response: Response): Promise<string> {
  let payload: unknown;
  try {
    payload = JSON.parse(await response.text());
  } catch {
    payload = null;
  }

  if (payload && typeof payload === "object") {
    const body = payload as Record<string, unknown>;
    if (typeof body.message === "string" && body.message) return body.message;
    if (body.details && typeof body.details === "object") {
      const first = Object.entries(body.details as Record<string, string>)[0];
      if (first) return `${first[0]}: ${first[1]}`;
    }
    if (typeof body.error === "string" && body.error) return humanise(body.error);
  }

  if (response.status === 403) return "You do not have permission to do that.";
  if (response.status === 404) return "That record no longer exists.";
  if (response.status === 409) return "That record conflicts with one that already exists.";
  return `The request failed (${response.status}).`;
}

function humanise(code: string): string {
  switch (code) {
    case "VALIDATION_ERROR":
      return "Some of the details are missing or invalid.";
    case "NOT_FOUND":
      return "That record no longer exists.";
    case "INTERNAL_ERROR":
      return "The clinic server ran into a problem. Please try again.";
    default:
      return code;
  }
}
