import { apiRequest } from "./client";

import type { AppUser, Role } from "@/types";



// -------------------------------------------------------------------- session

/**
 * Which branches a list should be read for. `null` means "no filter": an
 * admin may read the whole clinic. Everyone else must name a branch on the
 * operational lists (the API refuses an unscoped read), so their assigned
 * branches are read one by one and merged.
 */
export interface LoginResult {
  user: AppUser;
}

export async function login(email: string, password: string): Promise<LoginResult> {
  // The API answers with an HttpOnly session cookie; there is no token to keep.
  await apiRequest<{ expiresIn: number }>("/api/v1/auth/login", {
    method: "POST",
    body: { email, password },
    anonymous: true,
  });

  const profile = await apiRequest<MeResponse>("/api/v1/auth/me", { anonymous: true });
  // The backend now orders roles with the highest-privilege one first, but
  // picking ADMIN explicitly when present costs nothing and keeps this
  // correct even if that ordering ever regresses.
  const role = primaryRole(profile.roles);
  return {
    user: {
      id: String(profile.id),
      username: profile.email,
      password: "",
      role,
      permissions: profile.permissions ?? [],
      staffId: profile.staffId == null ? undefined : String(profile.staffId),
      displayName: `${profile.firstName} ${profile.lastName}`.trim() || profile.email,
      branchIds: (profile.branchIds ?? []).map(String),
      status: profile.active ? "ACTIVE" : "INACTIVE",
      lastLogin: new Date().toISOString(),
    },
  };
}

/** The API answers the same way whether or not the address has an account. */
export async function requestPasswordReset(email: string): Promise<void> {
  await apiRequest<void>("/api/v1/auth/password-reset/request", {
    method: "POST",
    body: { email },
    anonymous: true,
  });
}

export async function isPasswordResetTokenValid(token: string): Promise<boolean> {
  const result = await apiRequest<{ valid: boolean }>("/api/v1/auth/password-reset/validate", {
    method: "POST",
    body: { token },
    anonymous: true,
  });
  return result.valid;
}

export async function confirmPasswordReset(token: string, password: string): Promise<void> {
  await apiRequest<void>("/api/v1/auth/password-reset/confirm", {
    method: "POST",
    body: { token, password },
    anonymous: true,
  });
}

/**
 * The API names the therapist role PHYSIO; the app has always called it
 * PHYSIOTHERAPIST, and the menus and landing route are keyed by that name.
 */
export function primaryRole(roles: string[]): Role {
  if (roles.includes("ADMIN")) return "ADMIN";
  const first = roles[0] ?? "PHYSIOTHERAPIST";
  return first === "PHYSIO" ? "PHYSIOTHERAPIST" : first;
}

interface MeResponse {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  active: boolean;
  roles: string[];
  permissions: string[];
  staffId: number | null;
  branchIds: number[];
}

/** Re-reads the signed-in account, used after a refresh to check the session cookie. */
export const me = () => apiRequest<MeResponse>("/api/v1/auth/me");

/** Page script cannot delete an HttpOnly cookie, so the API expires it. */
export const logout = () =>
  apiRequest<void>("/api/v1/auth/logout", { method: "POST", anonymous: true });

export interface ConfiguredRole { id: number; code: string; name: string; permissions: string[] }
export interface ConfiguredPermission { id: number; code: string; name: string }
export const listConfiguredRoles = () => apiRequest<ConfiguredRole[]>("/api/v1/roles");
export const listConfiguredPermissions = () => apiRequest<ConfiguredPermission[]>("/api/v1/roles/permissions");
export const createConfiguredRole = (body: { code: string; name: string; permissionCodes: string[] }) =>
  apiRequest<ConfiguredRole>("/api/v1/roles", { method: "POST", body });
export const updateConfiguredRole = (id: number, body: { name: string; permissionCodes: string[] }) =>
  apiRequest<ConfiguredRole>(`/api/v1/roles/${id}`, { method: "PUT", body });
export const deleteConfiguredRole = (id: number) =>
  apiRequest<void>(`/api/v1/roles/${id}`, { method: "DELETE" });

