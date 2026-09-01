import type { CommissionRule } from "@/types";

export const commissionRules: CommissionRule[] = [
  {
    id: "cr-treat-standard",
    name: "Standard Treatment Commission",
    appliesTo: "TREATMENT",
    targetType: "ALL",
    commissionType: "PERCENTAGE",
    value: 5,
    effectiveDate: "2026-01-01",
    status: "ACTIVE",
  },
  {
    id: "cr-office-treat",
    name: "Office Syndrome Treatment Commission",
    appliesTo: "TREATMENT",
    targetType: "SERVICE",
    targetId: "svc-office",
    commissionType: "PERCENTAGE",
    value: 6,
    effectiveDate: "2026-01-01",
    status: "ACTIVE",
  },
  {
    id: "cr-sales-course",
    name: "Course Sales Commission",
    appliesTo: "SALES",
    targetType: "COURSE",
    commissionType: "PERCENTAGE",
    value: 8,
    effectiveDate: "2026-01-01",
    status: "ACTIVE",
  },
  {
    id: "cr-sales-single",
    name: "Single Visit Sales Commission",
    appliesTo: "SALES",
    targetType: "SERVICE",
    commissionType: "FIXED",
    value: 50,
    effectiveDate: "2026-01-01",
    status: "ACTIVE",
  },
  {
    id: "cr-postop-both",
    name: "Post-Op Rehab Combined Commission",
    appliesTo: "BOTH",
    targetType: "SERVICE",
    targetId: "svc-postop",
    commissionType: "PERCENTAGE",
    value: 7,
    effectiveDate: "2026-02-01",
    status: "ACTIVE",
  },
  {
    id: "cr-legacy-2025",
    name: "2025 Legacy Treatment Commission",
    appliesTo: "TREATMENT",
    targetType: "ALL",
    commissionType: "PERCENTAGE",
    value: 4,
    effectiveDate: "2025-01-01",
    status: "INACTIVE",
  },
];

export function getCommissionRuleById(id: string): CommissionRule | undefined {
  return commissionRules.find((r) => r.id === id);
}
