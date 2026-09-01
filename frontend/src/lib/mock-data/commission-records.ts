import type { Transaction } from "@/types";

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

export function getCommissionRecords(transactions: Transaction[]): CommissionRecord[] {
  const records: CommissionRecord[] = [];
  for (const t of transactions) {
    t.commission.forEach((c, i) => {
      records.push({
        id: `${t.id}-com-${i}`,
        staffId: c.staffId,
        transactionId: t.id,
        transactionNo: t.transactionNo,
        date: t.date,
        patientId: t.patientId,
        branchId: t.branchId,
        type: c.type,
        ruleId: c.ruleId,
        ruleName: c.ruleName,
        amount: c.amount,
        reversed: t.status === "VOID",
      });
    });
  }
  // Course-usage sessions are already paid for at purchase time, so treatment
  // commission on them computes to ฿0 — omit those rows rather than show
  // staff a "commission" line that never pays out.
  return records.filter((r) => r.amount !== 0).sort((a, b) => b.date.localeCompare(a.date));
}
