import type { CourseLedgerEntry, PatientCourse, PatientCourseStatus } from "@/types";
import { courseTemplates } from "./services";
import { staff } from "./staff";

export const TODAY = "2026-08-12";

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

interface CourseAssignment {
  patientCourseId: string;
  patientId: string;
  courseId: string;
  purchaseDate: string;
  branchId: string;
  usedSessions: number;
  transferOut?: { qty: number; date: string; toPatientCourseLabel?: string };
  transferIn?: { qty: number; date: string; fromPatientCourseLabel?: string };
  performedByStaffId: string;
  purchaseTransactionId?: string;
}

function staffName(staffId: string): string {
  return staff.find((s) => s.id === staffId)?.name ?? staffId;
}

export const courseAssignments: CourseAssignment[] = [
  {
    patientCourseId: "pc-001", patientId: "p-001", courseId: "crs-office10",
    purchaseDate: "2026-05-01", branchId: "br-bkk", usedSessions: 4,
    performedByStaffId: "stf-mgr2", purchaseTransactionId: "txn-100001",
  },
  {
    patientCourseId: "pc-002", patientId: "p-002", courseId: "crs-back5",
    purchaseDate: "2026-06-01", branchId: "br-bkk", usedSessions: 1,
    performedByStaffId: "stf-mgr2", purchaseTransactionId: "txn-100002",
  },
  {
    patientCourseId: "pc-003", patientId: "p-003", courseId: "crs-office10",
    purchaseDate: "2026-06-23", branchId: "br-sal", usedSessions: 7,
    performedByStaffId: "stf-asst1", purchaseTransactionId: "txn-100003",
  },
  {
    patientCourseId: "pc-004", patientId: "p-004", courseId: "crs-back5",
    purchaseDate: "2025-10-01", branchId: "br-bkk", usedSessions: 3,
    performedByStaffId: "stf-mgr2",
  },
  {
    patientCourseId: "pc-005", patientId: "p-005", courseId: "crs-sports20",
    purchaseDate: "2026-03-15", branchId: "br-sal", usedSessions: 24,
    performedByStaffId: "stf-asst1",
  },
  {
    patientCourseId: "pc-006", patientId: "p-006", courseId: "crs-wellness8",
    purchaseDate: "2026-07-01", branchId: "br-sal", usedSessions: 2,
    performedByStaffId: "stf-asst1",
  },
  {
    patientCourseId: "pc-007", patientId: "p-007", courseId: "crs-postop15",
    purchaseDate: "2026-04-10", branchId: "br-bkk", usedSessions: 10,
    performedByStaffId: "stf-mgr2",
  },
  {
    patientCourseId: "pc-008", patientId: "p-008", courseId: "crs-office10",
    purchaseDate: "2026-01-05", branchId: "br-sal", usedSessions: 12,
    performedByStaffId: "stf-asst1",
  },
  {
    patientCourseId: "pc-009", patientId: "p-009", courseId: "crs-back5",
    purchaseDate: "2026-07-20", branchId: "br-sal", usedSessions: 0,
    performedByStaffId: "stf-asst1",
  },
  {
    patientCourseId: "pc-010", patientId: "p-010", courseId: "crs-sports20",
    purchaseDate: "2025-12-01", branchId: "br-bkk", usedSessions: 5,
    performedByStaffId: "stf-mgr2",
  },
  {
    patientCourseId: "pc-011", patientId: "p-011", courseId: "crs-wellness8",
    purchaseDate: "2026-08-01", branchId: "br-sal", usedSessions: 0,
    performedByStaffId: "stf-asst1",
  },
  {
    patientCourseId: "pc-012", patientId: "p-012", courseId: "crs-office10",
    purchaseDate: "2026-06-10", branchId: "br-bkk", usedSessions: 5,
    transferOut: { qty: 2, date: "2026-07-15" },
    performedByStaffId: "stf-mgr2",
  },
];

function computeStatus(remaining: number, expiryDate: string): PatientCourseStatus {
  if (expiryDate < TODAY) return "EXPIRED";
  if (remaining <= 0) return "USED_UP";
  return "ACTIVE";
}

export const patientCourses: PatientCourse[] = [];
export const courseLedger: CourseLedgerEntry[] = [];

let ledgerSeq = 1;
function pushLedger(entry: Omit<CourseLedgerEntry, "id">) {
  courseLedger.push({ id: `led-${String(ledgerSeq++).padStart(4, "0")}`, ...entry });
}

for (const a of courseAssignments) {
  const template = courseTemplates.find((c) => c.id === a.courseId)!;
  const expiryDate = addDays(a.purchaseDate, template.expiryDays);
  const transferOutQty = a.transferOut?.qty ?? 0;
  const transferInQty = a.transferIn?.qty ?? 0;
  const remaining =
    template.sessions + template.bonusSessions - a.usedSessions - transferOutQty + transferInQty;
  const status = computeStatus(remaining, expiryDate);

  patientCourses.push({
    id: a.patientCourseId,
    patientId: a.patientId,
    courseId: a.courseId,
    purchaseDate: a.purchaseDate,
    expiryDate,
    purchased: template.sessions,
    bonus: template.bonusSessions,
    used: a.usedSessions,
    transferIn: transferInQty,
    transferOut: transferOutQty,
    branchId: a.branchId,
    status,
  });

  let balance = 0;
  balance += template.sessions;
  pushLedger({
    patientCourseId: a.patientCourseId,
    date: `${a.purchaseDate}T10:00:00`,
    type: "PURCHASE",
    quantity: template.sessions,
    balanceAfter: balance,
    branchId: a.branchId,
    relatedTransactionId: a.purchaseTransactionId,
    performedBy: staffName(a.performedByStaffId),
  });

  if (template.bonusSessions > 0) {
    balance += template.bonusSessions;
    pushLedger({
      patientCourseId: a.patientCourseId,
      date: `${a.purchaseDate}T10:00:00`,
      type: "BONUS",
      quantity: template.bonusSessions,
      balanceAfter: balance,
      branchId: a.branchId,
      relatedTransactionId: a.purchaseTransactionId,
      performedBy: staffName(a.performedByStaffId),
    });
  }

  const physiosAtBranch = staff.filter(
    (s) => s.position === "Physiotherapist" && s.branchIds.includes(a.branchId)
  );
  for (let i = 0; i < a.usedSessions; i++) {
    balance -= 1;
    const treatDate = addDays(a.purchaseDate, 3 + i * 7);
    const physio = physiosAtBranch[i % Math.max(physiosAtBranch.length, 1)];
    pushLedger({
      patientCourseId: a.patientCourseId,
      date: `${treatDate}T14:00:00`,
      type: "TREATMENT",
      quantity: -1,
      balanceAfter: balance,
      branchId: a.branchId,
      performedBy: physio?.name ?? staffName(a.performedByStaffId),
    });
  }

  if (a.transferOut) {
    balance -= a.transferOut.qty;
    pushLedger({
      patientCourseId: a.patientCourseId,
      date: `${a.transferOut.date}T11:00:00`,
      type: "TRANSFER_OUT",
      quantity: -a.transferOut.qty,
      balanceAfter: balance,
      branchId: a.branchId,
      performedBy: staffName(a.performedByStaffId),
    });
  }

  if (a.transferIn) {
    balance += a.transferIn.qty;
    pushLedger({
      patientCourseId: a.patientCourseId,
      date: `${a.transferIn.date}T11:00:00`,
      type: "TRANSFER_IN",
      quantity: a.transferIn.qty,
      balanceAfter: balance,
      branchId: a.branchId,
      performedBy: staffName(a.performedByStaffId),
    });
  }
}

export function getPatientCourseById(id: string): PatientCourse | undefined {
  return patientCourses.find((pc) => pc.id === id);
}

export function getPatientCoursesByPatient(patientId: string): PatientCourse[] {
  return patientCourses.filter((pc) => pc.patientId === patientId);
}

export function getLedgerByPatientCourse(patientCourseId: string): CourseLedgerEntry[] {
  return courseLedger
    .filter((l) => l.patientCourseId === patientCourseId)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function remainingSessions(pc: PatientCourse): number {
  return pc.purchased + pc.bonus + pc.transferIn - pc.used - pc.transferOut;
}
