import type { Branch, Patient } from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

interface DatabaseBranch {
  id: number;
  code: string;
  name: string;
  phone?: string;
  address?: string;
  active: boolean;
}

export interface DatabasePatient {
  id: number;
  hn: string;
  prefix: string;
  firstNameTh: string;
  lastNameTh: string;
  phone: string;
  genderCode: string;
  customerGroupCode?: string;
  branchId: number;
  active: boolean;
}

function headers(accessToken: string) {
  return { Authorization: `Bearer ${accessToken}` };
}

function toBranch(row: DatabaseBranch): Branch {
  return {
    id: String(row.id),
    code: row.code.trim(),
    name: row.name,
    phone: row.phone ?? "",
    address: row.address ?? "",
    status: row.active ? "ACTIVE" : "INACTIVE",
  };
}

export function toPatient(row: DatabasePatient): Patient {
  return {
    id: String(row.id),
    hn: row.hn,
    customerType: "THAI",
    titleTh: row.prefix,
    firstNameTh: row.firstNameTh,
    lastNameTh: row.lastNameTh,
    firstNameEn: "",
    lastNameEn: "",
    nickname: "",
    gender: row.genderCode as Patient["gender"],
    dob: "",
    bloodGroup: "",
    nationality: "Thai",
    phone: row.phone,
    address: "",
    customerGroup: row.customerGroupCode ?? "",
    referralChannel: "",
    insuranceCompany: "",
    registrationBranchId: String(row.branchId),
    createdAt: "",
  };
}

export async function getBranchesWithApi(accessToken: string) {
  const response = await fetch(`${API_URL}/api/branches`, { headers: headers(accessToken) });
  if (!response.ok) throw new Error("Unable to load branches from database");
  return (await response.json() as DatabaseBranch[]).map(toBranch);
}

export async function getPatientsWithApi(accessToken: string, search = "") {
  const query = search ? `?search=${encodeURIComponent(search)}` : "";
  const response = await fetch(`${API_URL}/api/v1/patients${query}`, { headers: headers(accessToken) });
  if (!response.ok) throw new Error("Unable to load patients from database");
  return (await response.json() as DatabasePatient[]).map(toPatient);
}

export async function createPatientWithApi(accessToken: string, input: {
  customerType: string;
  prefix: string;
  firstNameTh: string;
  lastNameTh: string;
  firstNameEn?: string;
  lastNameEn?: string;
  nickname?: string;
  genderCode: string;
  nationalIdCiphertext?: string;
  birthDate?: string;
  phone: string;
  addressJson?: string;
  customerGroupCode?: string;
  referralChannelCode?: string;
  insuranceCompanyCode?: string;
  registeredBranchId: number;
}) {
  const response = await fetch(`${API_URL}/api/v1/patients`, {
    method: "POST",
    headers: { ...headers(accessToken), "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error("Unable to save patient to database");
  return toPatient(await response.json() as DatabasePatient);
}
