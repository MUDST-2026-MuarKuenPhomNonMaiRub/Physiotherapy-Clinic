import type { Appointment, Branch, CourseTemplate, MasterDataItem, Patient, PatientCourse, PaymentMethod, Service, Staff } from "@/types";

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

function value(row: Record<string, unknown>, camel: string, snake: string) {
  return row[camel] ?? row[snake];
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

async function getJson<T>(accessToken: string, path: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, { headers: headers(accessToken) });
  if (!response.ok) throw new Error(`Unable to load ${path} from database`);
  return response.json() as Promise<T>;
}

export async function getCatalogWithApi(accessToken: string) {
  const [serviceRows, courseRows, paymentRows] = await Promise.all([
    getJson<Record<string, unknown>[]>(accessToken, "/api/v1/services"),
    getJson<Record<string, unknown>[]>(accessToken, "/api/v1/courses"),
    getJson<Record<string, unknown>[]>(accessToken, "/api/v1/payment-methods"),
  ]);

  const services: Service[] = serviceRows.map((row) => ({
    id: String(value(row, "id", "id")),
    name: String(value(row, "nameTh", "name_th") ?? ""),
    type: String(value(row, "serviceType", "service_type") ?? "SINGLE_VISIT") as Service["type"],
    price: Number(value(row, "basePrice", "base_price") ?? 0),
    duration: Number(value(row, "durationMinutes", "duration_minutes") ?? 0),
    status: Boolean(value(row, "active", "active")) ? "ACTIVE" : "INACTIVE",
  }));
  const courseTemplates: CourseTemplate[] = courseRows.map((row) => ({
    id: String(value(row, "id", "id")),
    name: String(value(row, "nameTh", "name_th") ?? ""),
    description: String(value(row, "nameEn", "name_en") ?? ""),
    price: Number(value(row, "price", "price") ?? 0),
    sessions: Number(value(row, "totalSessions", "total_sessions") ?? 0),
    bonusSessions: 0,
    expiryDays: Number(value(row, "validityDays", "validity_days") ?? 0),
    status: Boolean(value(row, "active", "active")) ? "ACTIVE" : "INACTIVE",
  }));
  const paymentMethods: PaymentMethod[] = paymentRows.map((row) => ({
    id: String(value(row, "id", "id")),
    name: String(value(row, "name", "name") ?? ""),
    icon: "credit-card",
    enabled: Boolean(value(row, "active", "active")),
  }));
  return { services, courseTemplates, paymentMethods };
}

export async function getMasterDataWithApi(accessToken: string, category: MasterDataItem["category"]) {
  const rows = await getJson<Record<string, unknown>[]>(accessToken, `/api/v1/master-data/${category}`);
  return rows.map((row) => ({
    id: String(value(row, "id", "id")),
    category,
    value: String(value(row, "nameTh", "name_th") ?? value(row, "code", "code") ?? ""),
    status: Boolean(value(row, "active", "active")) ? "ACTIVE" : "INACTIVE",
  } satisfies MasterDataItem));
}

export async function getAppointmentsWithApi(accessToken: string, branchId?: string) {
  const query = branchId ? `?branchId=${encodeURIComponent(branchId)}` : "";
  const rows = await getJson<Record<string, unknown>[]>(accessToken, `/api/v1/appointments${query}`);
  return rows.map((row) => {
    const startsAt = String(value(row, "startsAt", "starts_at") ?? "");
    const endsAt = String(value(row, "endsAt", "ends_at") ?? "");
    return {
      id: String(value(row, "id", "id")),
      patientId: String(value(row, "patientId", "patient_id")),
      date: startsAt.slice(0, 10),
      startTime: startsAt.slice(11, 16),
      endTime: endsAt.slice(11, 16),
      branchId: String(value(row, "branchId", "branch_id")),
      physiotherapistId: String(value(row, "providerStaffId", "provider_staff_id")),
      serviceId: String(value(row, "serviceId", "service_id")),
      resourceId: String(value(row, "roomId", "room_id") ?? ""),
      note: String(value(row, "patientNote", "patient_note") ?? ""),
      status: String(value(row, "status", "status") ?? "CONFIRMED") as Appointment["status"],
      createdAt: String(value(row, "createdAt", "created_at") ?? ""),
    } satisfies Appointment;
  });
}

export async function getPatientCoursesWithApi(accessToken: string, branchId?: string) {
  const query = branchId ? `?branchId=${encodeURIComponent(branchId)}` : "";
  const rows = await getJson<Record<string, unknown>[]>(accessToken, `/api/v1/patient-courses${query}`);
  return rows.map((row) => ({
    id: String(value(row, "id", "id")),
    patientId: String(value(row, "patientId", "patient_id")),
    courseId: String(value(row, "packageId", "package_id")),
    purchaseDate: String(value(row, "purchaseDate", "purchase_date") ?? ""),
    expiryDate: String(value(row, "expiryDate", "expiry_date") ?? ""),
    purchased: Number(value(row, "purchased", "purchased") ?? 0),
    bonus: Number(value(row, "bonus", "bonus") ?? 0),
    used: Number(value(row, "used", "used") ?? 0),
    transferIn: 0,
    transferOut: 0,
    branchId: String(value(row, "branchId", "branch_id")),
    status: String(value(row, "status", "status") ?? "ACTIVE") as PatientCourse["status"],
  } satisfies PatientCourse));
}
