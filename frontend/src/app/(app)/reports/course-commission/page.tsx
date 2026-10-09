"use client";

import { useEffect, useState } from "react";
import { PiggyBank, Wallet, HandCoins, PackageOpen, Eye, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { getCourseCommissionReport, getCourseCommissionStaffDetail } from "@/lib/api/clinic-api";
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
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  const [detail, setDetail] = useState<Record<string, unknown>[] | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailStaffId, setDetailStaffId] = useState<string | null>(null);

  const openDetail = async (staffId: string) => {
    setDetailStaffId(staffId);
    setDetailLoading(true);
    try {
      setDetail(await getCourseCommissionStaffDetail(staffId, dateFrom, dateTo));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load course details");
    } finally {
      setDetailLoading(false);
    }
  };

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

      <div className="mb-5 rounded-xl border border-primary/20 bg-primary/[0.03] p-4">
        <p className="mb-3 text-sm font-semibold text-foreground">How course commission moves</p>
        <div className="grid gap-2 text-xs sm:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] sm:items-center">
          <FlowStep number="1" title="Full-price sales credit" detail="Split between case owners at purchase" />
          <ArrowRight className="hidden h-4 w-4 text-muted-foreground sm:block" />
          <FlowStep number="2" title="Monthly tier locked" detail="Each owner's tier is frozen at closing" />
          <ArrowRight className="hidden h-4 w-4 text-muted-foreground sm:block" />
          <FlowStep number="3" title="Pool per visit" detail="Pool ÷ paid and bonus visits" />
          <ArrowRight className="hidden h-4 w-4 text-muted-foreground sm:block" />
          <FlowStep number="4" title="Visit payout" detail="Treatment fee to substitute; remainder to owner" />
        </div>
      </div>

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
                  <TableHead className="text-right">Special Immediate</TableHead>
                  <TableHead className="text-right">Gross Allocated</TableHead>
                  <TableHead className="text-right">Owner Net</TableHead>
                  <TableHead className="text-right">Treatment Fee</TableHead>
                  <TableHead className="text-right">Adjustment</TableHead>
                  <TableHead className="text-right">Outstanding</TableHead>
                  <TableHead className="text-right">Total Variable Pay</TableHead>
                  <TableHead className="text-right">Details</TableHead>
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
                    <TableCell className="text-right text-success">
                      {formatCurrency(r.specialImmediateCommission)}
                    </TableCell>
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
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => openDetail(r.staffId)}>
                        <Eye className="mr-1 h-4 w-4" /> View Details
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <Dialog open={detail !== null} onOpenChange={(open) => { if (!open) { setDetail(null); setDetailStaffId(null); } }}>
        <DialogContent className="flex !h-[calc(100vh-2rem)] !w-[calc(100vw-2rem)] !max-w-none flex-col overflow-hidden p-8">
          <DialogHeader>
            <DialogTitle>Commission Allocation Details · {staff.find((member) => member.id === detailStaffId)?.name ?? "Staff"}</DialogTitle>
            <DialogDescription>
              Follow each course from full-price sales credit to pool, visit allocation, treatment fee and owner net.
            </DialogDescription>
          </DialogHeader>
          {detailLoading ? (
            <p className="py-8 text-center text-muted-foreground">กำลังโหลดรายละเอียด...</p>
          ) : detail ? (
            <div className="min-h-0 flex-1 overflow-auto rounded-lg border">
              <Table className="min-w-[1580px] text-sm">
                <TableHeader><TableRow><TableHead>Course</TableHead><TableHead>Sale Date</TableHead><TableHead>Visit Date</TableHead><TableHead>Case Owner</TableHead><TableHead>Treating PT</TableHead><TableHead className="text-right">Sales Credit</TableHead><TableHead className="text-right">Visits</TableHead><TableHead className="text-right">Pool / Visit</TableHead><TableHead className="text-right">Pool / Immediate</TableHead><TableHead className="text-right">Gross</TableHead><TableHead className="text-right">Treatment Fee</TableHead><TableHead className="text-right">Owner Net</TableHead><TableHead className="text-right">Outstanding</TableHead></TableRow></TableHeader>
                <TableBody>
                  {detail.map((a, index) => {
                    const ownerId = String(a.case_owner_employee_id ?? detailStaffId ?? "");
                    const treatingId = String(a.treating_employee_id ?? "");
                    const immediate = Number(a.special_immediate_commission ?? 0);
                    return <TableRow key={`${String(a.id ?? index)}-${String(a.visit_date ?? "course")}`}>
                      <TableCell><p className="font-medium">{String(a.package_name_snapshot ?? "-")}</p><p className="font-mono text-xs text-muted-foreground">{String(a.course_id ?? "-")}</p></TableCell>
                      <TableCell>{String(a.sale_date ?? "-")}</TableCell>
                      <TableCell>{String(a.visit_date ?? "-")}</TableCell>
                      <TableCell>{staff.find((member) => member.id === ownerId)?.name ?? "-"}</TableCell>
                      <TableCell>{treatingId ? staff.find((member) => member.id === treatingId)?.name ?? "-" : "-"}</TableCell>
                      <TableCell className="text-right">{formatCurrency(Number(a.sales_credit_amount ?? 0))}</TableCell>
                      <TableCell className="text-right">{String(a.allocated_visits ?? "-")}</TableCell>
                      <TableCell className="text-right">{formatCurrency(Number(a.commission_allocation_per_visit ?? 0))}</TableCell>
                      <TableCell className="text-right">{immediate > 0 ? `${formatCurrency(immediate)} immediate` : formatCurrency(Number(a.total_course_commission_pool ?? 0))}</TableCell>
                      <TableCell className="text-right">{formatCurrency(Number(a.gross_commission_allocation ?? 0))}</TableCell>
                      <TableCell className="text-right text-info">{formatCurrency(Number(a.treatment_fee_amount ?? 0))}</TableCell>
                      <TableCell className="text-right text-success">{formatCurrency(Number(a.owner_net_commission ?? 0))}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{formatCurrency(Number(a.outstanding_pool ?? 0))}</TableCell>
                    </TableRow>;
                  })}
                  {detail.length === 0 && <TableRow><TableCell colSpan={13} className="text-center text-muted-foreground">No commission details yet</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function FlowStep({ number, title, detail }: { number: string; title: string; detail: string }) {
  return (
    <div className="rounded-lg border border-border bg-background/80 p-3">
      <div className="flex items-center gap-2">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">{number}</span>
        <span className="font-semibold text-foreground">{title}</span>
      </div>
      <p className="mt-1 text-muted-foreground">{detail}</p>
    </div>
  );
}
