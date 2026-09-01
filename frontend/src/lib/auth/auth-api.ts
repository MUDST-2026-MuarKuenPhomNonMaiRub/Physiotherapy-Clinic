import type { AppUser, Role } from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

interface LoginResponse {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
}

interface MeResponse {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  active: boolean;
  roles: string[];
}

function toAppUser(user: MeResponse): AppUser {
  const role: Role = user.roles.includes("ADMIN") ? "ADMIN" : "PHYSIOTHERAPIST";

  return {
    id: String(user.id),
    username: user.email,
    password: "",
    role,
    displayName: `${user.firstName} ${user.lastName}`.trim(),
    branchIds: [],
    status: user.active ? "ACTIVE" : "INACTIVE",
    lastLogin: new Date().toISOString(),
  };
}

export async function loginWithApi(email: string, password: string) {
  const response = await fetch(`${API_URL}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    throw new Error("Invalid email or password");
  }

  const login: LoginResponse = await response.json();
  const meResponse = await fetch(`${API_URL}/api/v1/auth/me`, {
    headers: { Authorization: `${login.tokenType} ${login.accessToken}` },
  });

  if (!meResponse.ok) {
    throw new Error("Unable to load user profile");
  }

  return {
    accessToken: login.accessToken,
    user: toAppUser(await meResponse.json()),
  };
}

export async function createUserWithApi(input: {
  accessToken: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: Role;
}) {
  const response = await fetch(`${API_URL}/api/v1/auth/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${input.accessToken}`,
    },
    body: JSON.stringify({
      email: input.email,
      password: input.password,
      firstName: input.firstName,
      lastName: input.lastName,
      role: input.role,
    }),
  });

  if (!response.ok) {
    if (response.status === 409) throw new Error("This email is already in use");
    if (response.status === 403) throw new Error("Only an admin can create accounts");
    throw new Error("Unable to create staff account");
  }
}

export async function createStaffWithApi(input: {
  accessToken: string;
  name: string;
  nameEn: string;
  position: string;
  phone: string;
  email: string;
  branchIds: string[];
  role: Role;
  password: string;
  avatarColor: string;
}) {
  const response = await fetch(`${API_URL}/api/v1/staff`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${input.accessToken}`,
    },
    body: JSON.stringify({
      email: input.email,
      password: input.password,
      name: input.name,
      nameEn: input.nameEn || "Staff",
      role: input.role,
      position: input.position,
      phone: input.phone,
      branchIds: JSON.stringify(input.branchIds),
      avatarColor: input.avatarColor,
    }),
  });
  if (!response.ok) {
    if (response.status === 409) throw new Error("This email is already in use");
    throw new Error("Unable to save staff to database");
  }
  return response.json() as Promise<{ staffId: number; userId: number | null }>;
}

export async function deleteStaffWithApi(accessToken: string, email: string) {
  const response = await fetch(`${API_URL}/api/v1/staff/by-email/${encodeURIComponent(email)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok && response.status !== 404) throw new Error("Unable to archive staff");
}

export interface DatabaseStaffRow {
  id: number;
  name: string;
  nameEn: string;
  position: string;
  phone: string;
  email: string;
  branchIds: string;
  status: string;
  avatarColor: string;
  userId: number;
  userRole: string;
  userActive: boolean;
}

export async function getStaffWithApi(accessToken: string) {
  const response = await fetch(`${API_URL}/api/v1/staff`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error("Unable to load staff from database");
  return response.json() as Promise<DatabaseStaffRow[]>;
}
