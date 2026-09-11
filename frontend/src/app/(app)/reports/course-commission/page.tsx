"use client";

import { useEffect, useState } from "react";
import { PiggyBank, Wallet, HandCoins, PackageOpen } from "lucide-react";
import { toast } from "sonner";
import { getCourseCommissionReport } from "@/lib/api/clinic-api";
import { useClinicStore } from "@/lib/store/clinic-store";
import { useReportScope } from "@/lib/auth/use-report-scope";
import { today } from "@/lib/domain";
import { formatCurrency } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { ReportsNav } from "@/components/reports/reports-nav";
import { ScopeNotice } from "@/components/reports/scope-notice";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { CourseCommissionReportRow } from "@/types";

function defaultRange(): { from: string; to: string } {
  const to = today();
  const start = new Date(`${to}T00:00:00`);
  start.setDate(start.getDate() - 42);
  const pad = (v: number) => String(v).padStart(2, "0");
  return {
    from: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`,
    to,
  };
}

/**
 * The tier/pool model's own report — Generated, Gross, Owner Net, Treatment
 * Fee, Adjustment and Outstanding per staff member. See the plain
 * "Commission" report for the separate, immediate per-receipt incentive.
 */
export default function CourseCommissionReportPage() {
  const staff = useClinicStore((s) => s.staff);
  const { seesEveryone, ownStaffId, ownName } = useReportScope();
  const [range] = useState(defaultRange);
  const [dateFrom, setDateFrom] = useState(range.from);
  const [dateTo, setDateTo] = useState(range.to);
  const [rows, setRows] = useState<CourseCommissionReportRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    // Loading starts true from useState; only turned off below, so switching
    // the date range just swaps the table in place rather than re-flashing it.
    getCourseCommissionReport(dateFrom, dateTo, seesEveryone ? undefined : ownStaffId ?? undefined)
      .then((result) => {
        if (!cancelled) setRows(result);
      })
      .catch((error) => {
        if (!cancelled) toast.error(error instanceof Error ? error.message : "Could not load the report");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dateFrom, dateTo, seesEveryone, ownStaffId]);

  const totals = rows.reduce(
    (acc, r) => ({
      generated: acc.generated + r.commissionGenerated,
      ownerNet: acc.ownerNet + r.ownerNetReleased,
      fee: acc.fee + r.treatmentFeeEarned,
      outstanding: acc.outstanding + r.outstandingPool,
      variablePay: acc.variablePay + r.totalVariablePay,
    }),
    { generated: 0, ownerNet: 0, fee: 0, outstanding: 0, variablePay: 0 }
  );

  return (
    <>
      <PageHeader
        title="Course Commission"
        description={
          seesEveryone
            ? "Course-pool commission released per visit, by staff member"
            : "Your course-pool commission released per visit"
        }
      />
      <ReportsNav />
      {!seesEveryone && <ScopeNotice name={ownName} />}

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-40" />
        <span className="text-sm text-muted-foreground">to</span>
        <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-40" />
      </div>

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Commission Generated" value={formatCurrency(totals.generated)} icon={PiggyBank} tone="primary" />
        <StatCard label="Owner Net Released" value={formatCurrency(totals.ownerNet)} icon={Wallet} tone="success" />
        <StatCard label="Treatment Fee Earned" value={formatCurrency(totals.fee)} icon={HandCoins} tone="info" />
        <StatCard label="Outstanding Pool" value={formatCurrency(totals.outstanding)} icon={PackageOpen} tone="warning" />
      </div>

      {!loading && rows.length === 0 ? (
        <EmptyState icon={PiggyBank} title="No course commission in this range" />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff</TableHead>
                  <TableHead className="text-right">Monthly Course Sales</TableHead>
                  <TableHead className="text-right">Generated</TableHead>
                  <TableHead className="text-right">Gross Allocated</TableHead>
                  <TableHead className="text-right">Owner Net</TableHead>
                  <TableHead className="text-right">Treatment Fee</TableHead>
                  <TableHead className="text-right">Adjustment</TableHead>
                  <TableHead className="text-right">Outstanding</TableHead>
                  <TableHead className="text-right">Total Variable Pay</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.staffId}>
                    <TableCell className="font-medium text-foreground">
                      {staff.find((s) => s.id === r.staffId)?.name ?? r.staffName}
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(r.monthlyCourseSales)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(r.commissionGenerated)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(r.grossAllocated)}</TableCell>
                    <TableCell className="text-right text-success">{formatCurrency(r.ownerNetReleased)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(r.treatmentFeeEarned)}</TableCell>
                    <TableCell className={`text-right ${r.adjustments < 0 ? "text-destructive" : ""}`}>
                      {formatCurrency(r.adjustments)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">{formatCurrency(r.outstandingPool)}</TableCell>
                    <TableCell className="text-right font-semibold text-foreground">
                      {formatCurrency(r.totalVariablePay)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </>
  );
}
