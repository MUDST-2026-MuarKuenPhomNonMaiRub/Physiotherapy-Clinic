/**
 * Pure helpers over the domain types. No data lives here — every collection
 * comes from the API through the clinic store.
 */
import type {
  MasterDataItem,
  Patient,
  PatientCourse,
  Transaction,
} from "@/types";

/** The clinic's current date as YYYY-MM-DD, in the browser's own zone. */
export function today(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

// ------------------------------------------------------------------ validation

/**
 * The same rules the API enforces, repeated here so a form can answer straight
 * away. The server remains the one that decides — these only save a round trip.
 */
export const fieldRules = {
  nationalId(value: string): string | null {
    if (!value.trim()) return "Required";
    return /^\d{13}$/.test(value.trim()) ? null : "A Thai national ID has exactly 13 digits";
  },

  passport(value: string): string | null {
    if (!value.trim()) return "Required";
    return /^[A-Za-z0-9]{5,20}$/.test(value.trim())
      ? null
      : "5 to 20 letters or digits";
  },

  phone(value: string): string | null {
    if (!value.trim()) return "Required";
    const trimmed = value.trim();
    // Kept apart so a number that is merely short does not get told off for
    // characters it does not contain.
    if (!/^[0-9+\-() ]+$/.test(trimmed)) return "Only digits and + - ( ) spaces";
    if (trimmed.length > 25) return "That is too long for a phone number";
    return trimmed.replace(/[^0-9]/g, "").length >= 6 ? null : "Not enough digits";
  },

  birthDate(value: string): string | null {
    if (!value) return "Required";
    if (value > today()) return "A date of birth cannot be in the future";
    const hundredAndThirtyYearsAgo = new Date();
    hundredAndThirtyYearsAgo.setFullYear(hundredAndThirtyYearsAgo.getFullYear() - 130);
    return value > hundredAndThirtyYearsAgo.toISOString().slice(0, 10)
      ? null
      : "That date is not plausible";
  },
};

/**
 * Drop characters the field cannot hold as they are typed, the way the national
 * ID box already does. Catching it at the keystroke is clearer than letting
 * someone finish a wrong entry and explaining afterwards.
 */
export const fieldInput = {
  phone: (value: string) => value.replace(/[^0-9+\-() ]/g, "").slice(0, 25),
  passport: (value: string) => value.replace(/[^A-Za-z0-9]/g, "").slice(0, 20).toUpperCase(),
};

// -------------------------------------------------------------------- patients

export function getPatientFullNameTh(patient: Patient): string {
  return `${patient.titleTh}${patient.firstNameTh} ${patient.lastNameTh}`.trim();
}

export function getPatientFullNameEn(patient: Patient): string {
  return `${patient.firstNameEn} ${patient.lastNameEn}`.trim();
}

export function searchPatients(query: string, list: Patient[]): Patient[] {
  const term = query.trim().toLowerCase();
  if (!term) return list;
  return list.filter((patient) =>
    [
      patient.hn,
      patient.firstNameTh,
      patient.lastNameTh,
      patient.firstNameEn,
      patient.lastNameEn,
      patient.nickname,
      patient.phone,
      getPatientFullNameTh(patient),
      getPatientFullNameEn(patient),
    ]
      .filter(Boolean)
      .some((field) => field.toLowerCase().includes(term))
  );
}

/**
 * The HN the server will mint: YY + branch code + MM + a running number that
 * restarts each month per branch. Shown as a preview only — registration takes
 * the real one from the API response.
 */
export function previewHN(branchCode: string, sequence: number): string {
  const now = new Date();
  const year = String(now.getFullYear() % 100).padStart(2, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}${branchCode}${month}${String(sequence).padStart(4, "0")}`;
}

// ----------------------------------------------------------------- master data

export function getMasterDataByCategory(
  items: MasterDataItem[],
  category: MasterDataItem["category"]
): MasterDataItem[] {
  return items.filter((item) => item.category === category);
}

// --------------------------------------------------------------------- courses

export function remainingSessions(course: PatientCourse): number {
  return (
    course.purchased + course.bonus + course.transferIn - course.used - course.transferOut
  );
}

// ------------------------------------------------------------------ commission

export interface CommissionRecord {
  id: string;
  staffId: string;
  transactionId: string;
  transactionNo: string;
  date: string;
  patientId: string;
  branchId: string;
  type: "TREATMENT" | "SALES";
  ruleId: string;
  ruleName: string;
  amount: number;
  reversed: boolean;
}

/**
 * Flattens the commission lines on each receipt into one row per staff member
 * per rule, which is what the commission report reads.
 */
export function getCommissionRecords(transactions: Transaction[]): CommissionRecord[] {
  const records: CommissionRecord[] = [];
  for (const transaction of transactions) {
    transaction.commission.forEach((line, index) => {
      records.push({
        id: `${transaction.id}-com-${index}`,
        staffId: line.staffId,
        transactionId: transaction.id,
        transactionNo: transaction.transactionNo,
        date: transaction.date,
        patientId: transaction.patientId,
        branchId: transaction.branchId,
        type: line.type,
        ruleId: line.ruleId,
        ruleName: line.ruleName,
        amount: line.amount,
        reversed: transaction.status === "VOID",
      });
    });
  }
  // A course session was already paid for at purchase time, so treatment
  // commission on it computes to ฿0 — those rows are dropped rather than shown
  // to staff as a "commission" that never pays out.
  return records.filter((record) => record.amount !== 0);
}
