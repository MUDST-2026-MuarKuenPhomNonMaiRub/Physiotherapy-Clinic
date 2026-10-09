/**
 * The single door to the clinic API. The signed-in session is an HttpOnly
 * cookie the browser attaches by itself — page script never holds the token —
 * and every failure arrives as an ApiError whose message is safe to show at
 * the counter.
 */

/**
 * An empty value is deliberate: the production build sets it to "" so requests
 * go to the page's own origin, where Caddy hands /api to the backend. Only an
 * unset variable falls back to the local API.
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

const REQUEST_TIMEOUT_MS = 15_000;

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, anonymous = false } = options;
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";

  let response: Response;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      // The API is another origin in development; send the session cookie to it.
      credentials: "include",
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiError("The clinic server took too long to respond. Please try again.", 408);
    }
    throw new ApiError("Cannot reach the clinic server. Check that the API is running.", 0);
  } finally {
    window.clearTimeout(timeout);
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
