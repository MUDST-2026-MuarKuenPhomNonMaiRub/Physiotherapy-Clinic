import type {
  CommissionLine,
  CourseImpactEntry,
  Transaction,
  TransactionLineItem,
} from "@/types";
import { appointments } from "./appointments";
import { commissionRules } from "./commission-rules";
import {
  courseAssignments,
  courseLedger,
  patientCourses,
} from "./course-data";
import { getCourseTemplateById, getServiceById } from "./services";
import { staff } from "./staff";

const paymentCycle = ["pm-cash", "pm-transfer", "pm-qr"];

function pickPaymentMethod(seed: number): string {
  return paymentCycle[seed % paymentCycle.length];
}

function findRule(
  appliesTo: "TREATMENT" | "SALES",
  targetType: "SERVICE" | "COURSE",
  targetId: string,
  date: string
) {
  const specific = commissionRules.find(
    (r) =>
      r.status === "ACTIVE" &&
      (r.appliesTo === appliesTo || r.appliesTo === "BOTH") &&
      r.targetType === targetType &&
      r.targetId === targetId &&
      r.effectiveDate <= date
  );
  if (specific) return specific;
  const categoryWildcard = commissionRules.find(
    (r) =>
      r.status === "ACTIVE" &&
      (r.appliesTo === appliesTo || r.appliesTo === "BOTH") &&
      r.targetType === targetType &&
      !r.targetId &&
      r.effectiveDate <= date
  );
  if (categoryWildcard) return categoryWildcard;
  return commissionRules.find(
    (r) =>
      r.status === "ACTIVE" &&
      (r.appliesTo === appliesTo || r.appliesTo === "BOTH") &&
      r.targetType === "ALL" &&
      r.effectiveDate <= date
  );
}

function commissionFor(
  appliesTo: "TREATMENT" | "SALES",
  targetType: "SERVICE" | "COURSE",
  targetId: string,
  base: number,
  staffId: string,
  date: string
): CommissionLine[] {
  const rule = findRule(appliesTo, targetType, targetId, date);
  if (!rule) return [];
  const amount =
    rule.commissionType === "PERCENTAGE"
      ? Math.round((base * rule.value) / 100)
      : rule.value;
  return [
    {
      ruleId: rule.id,
      ruleName: rule.name,
      staffId,
      type: appliesTo === "TREATMENT" ? "TREATMENT" : "SALES",
      amount,
    },
  ];
}

export const transactions: Transaction[] = [];
let txnSeq = 1;
function nextTxnNo(): string {
  return `INV-2026-${String(txnSeq++).padStart(6, "0")}`;
}

// ---- 1. Course purchase transactions ----
for (const a of courseAssignments) {
  const template = getCourseTemplateById(a.courseId)!;
  const txnId = a.purchaseTransactionId ?? `txn-purchase-${a.patientCourseId}`;
  const items: TransactionLineItem[] = [
    { description: `${template.name} (${template.sessions} Sessions)`, qty: 1, amount: template.price },
  ];
  const courseImpact: CourseImpactEntry[] = [
    { label: `${template.name} — Purchase`, quantity: template.sessions },
  ];
  if (template.bonusSessions > 0) {
    courseImpact.push({ label: `${template.name} — Bonus`, quantity: template.bonusSessions });
  }
  const salesperson = a.performedByStaffId;
  const commission = commissionFor(
    "SALES", "COURSE", a.courseId, template.price, salesperson, a.purchaseDate
  );

  transactions.push({
    id: txnId,
    transactionNo: nextTxnNo(),
    date: `${a.purchaseDate}T10:00:00`,
    patientId: a.patientId,
    branchId: a.branchId,
    type: "COURSE_PURCHASE",
    items,
    subtotal: template.price,
    total: template.price,
    paymentMethodId: pickPaymentMethod(txnSeq),
    salespersonId: salesperson,
    status: "COMPLETED",
    courseImpact,
    commission,
    patientCourseId: a.patientCourseId,
  });

  // backfill ledger linkage for purchase/bonus rows that weren't pre-wired
  for (const l of courseLedger) {
    if (
      l.patientCourseId === a.patientCourseId &&
      (l.type === "PURCHASE" || l.type === "BONUS") &&
      !l.relatedTransactionId
    ) {
      l.relatedTransactionId = txnId;
    }
  }
}

// ---- 2. Course usage (treatment) transactions — linked to ledger TREATMENT rows ----
let usageSeq = 1;
for (const a of courseAssignments) {
  const pc = patientCourses.find((p) => p.id === a.patientCourseId)!;
  const template = getCourseTemplateById(pc.courseId)!;
  const treatmentEntries = courseLedger.filter(
    (l) => l.patientCourseId === a.patientCourseId && l.type === "TREATMENT"
  );
  for (const entry of treatmentEntries) {
    const txnId = `txn-usage-${String(usageSeq).padStart(4, "0")}`;
    usageSeq++;
    const treatingStaff =
      staff.find((s) => s.name === entry.performedBy)?.id ?? a.performedByStaffId;
    const commission = commissionFor(
      "TREATMENT", "COURSE", pc.courseId, 0, treatingStaff, entry.date.slice(0, 10)
    );
    transactions.push({
      id: txnId,
      transactionNo: nextTxnNo(),
      date: entry.date,
      patientId: a.patientId,
      branchId: entry.branchId,
      type: "COURSE_USAGE",
      items: [{ description: `${template.name} — Session Usage`, qty: 1, amount: 0 }],
      subtotal: 0,
      total: 0,
      paymentMethodId: "pm-cash",
      treatingStaffId: treatingStaff,
      status: "COMPLETED",
      courseImpact: [{ label: `${template.name} — Treatment`, quantity: -1 }],
      commission,
      patientCourseId: a.patientCourseId,
    });
    entry.relatedTransactionId = txnId;
  }
}

// ---- 3. Single visit / assessment transactions from checked-out appointments ----
let visitSeq = 1;
for (const apt of appointments) {
  if (apt.status !== "COMPLETED" || !apt.checkedOut) continue;
  const service = getServiceById(apt.serviceId)!;
  const txnId = `txn-visit-${String(visitSeq).padStart(4, "0")}`;
  visitSeq++;
  // Whoever was on shift at that branch closed the sale.
  const salesperson =
    staff.find((s) => s.status === "ACTIVE" && s.branchIds.includes(apt.branchId))?.id ?? staff[0].id;
  const commissionTreat = commissionFor(
    "TREATMENT", "SERVICE", apt.serviceId, service.price, apt.physiotherapistId, apt.date
  );
  const commissionSales = commissionFor(
    "SALES", "SERVICE", apt.serviceId, service.price, salesperson, apt.date
  );
  transactions.push({
    id: txnId,
    transactionNo: nextTxnNo(),
    date: `${apt.date}T${apt.endTime}:00`,
    patientId: apt.patientId,
    branchId: apt.branchId,
    appointmentId: apt.id,
    type: service.type === "ASSESSMENT" ? "ASSESSMENT" : "SINGLE_VISIT",
    items: [{ description: service.name, qty: 1, amount: service.price }],
    subtotal: service.price,
    total: service.price,
    paymentMethodId: pickPaymentMethod(visitSeq),
    treatingStaffId: apt.physiotherapistId,
    salespersonId: salesperson,
    status: "COMPLETED",
    courseImpact: [],
    commission: [...commissionTreat, ...commissionSales],
  });
}

// ---- 4. Historical void example (for Transaction status demo) ----
transactions.push({
  id: "txn-void-demo",
  transactionNo: nextTxnNo(),
  date: "2026-07-10T15:20:00",
  patientId: "p-013",
  branchId: "br-sal",
  type: "SINGLE_VISIT",
  items: [{ description: "Lower Back Pain Therapy", qty: 1, amount: 1000 }],
  subtotal: 1000,
  total: 1000,
  paymentMethodId: "pm-cash",
  treatingStaffId: "stf-phy3",
  salespersonId: "stf-asst1",
  status: "VOID",
  courseImpact: [],
  commission: [],
  voidInfo: {
    voidBy: "ปิยะดา เอื้อเฟื้อ",
    voidAt: "2026-07-11T09:15:00",
    reason: "บันทึกรายการซ้ำโดยผิดพลาด (Duplicate entry)",
  },
});

transactions.sort((a, b) => b.date.localeCompare(a.date));

export function getTransactionById(id: string): Transaction | undefined {
  return transactions.find((t) => t.id === id);
}

export function getTransactionsByPatient(patientId: string): Transaction[] {
  return transactions.filter((t) => t.patientId === patientId);
}
