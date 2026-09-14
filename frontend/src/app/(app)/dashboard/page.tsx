"use client";

import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Users, UserPlus, UserRound, Wallet } from "lucide-react";
import { useClinicStore } from "@/lib/store/clinic-store";
import { useBranchScope } from "@/lib/auth/use-branch-scope";
import { formatCurrency } from "@/lib/format";
import { localDate, today } from "@/lib/domain";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { BranchFilterSelect } from "@/components/shared/branch-filter-select";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getCourseCommissionReport } from "@/lib/api/clinic-api";
import type { CourseCommissionReportRow } from "@/types";

type Period = "day" | "month" | "year";
const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function periodBounds(period: Period, value: string) {
  if (period === "day") return { from: value, to: value };
  if (period === "month") {
    const [year, month] = value.split("-").map(Number);
    const last = new Date(year, month, 0).getDate();
    return { from: `${value}-01`, to: `${value}-${String(last).padStart(2, "0")}` };
  }
  return { from: `${value}-01-01`, to: `${value}-12-31` };
}

function yearOptions(transactions: { date: string }[]) {
  const years = new Set(transactions.map((t) => localDate(t.date).slice(0, 4)));
  years.add(today().slice(0, 4));
  return Array.from(years).sort().reverse();
}

export default function DashboardPage() {
  const transactions = useClinicStore((s) => s.transactions);
  const patients = useClinicStore((s) => s.patients);
  const branches = useClinicStore((s) => s.branches);
  const { isAccessible } = useBranchScope();
  const currentYear = today().slice(0, 4);
  const [period, setPeriod] = useState<Period>("month");
  const [periodValue, setPeriodValue] = useState(today().slice(0, 7));

  /**
   * The value box changes shape with the period (YYYY-MM-DD / YYYY-MM / YYYY),
   * so the current selection is re-cut to the new shape instead of being left
   * behind in the old one, which would match nothing.
   */
  function changePeriod(next: Period) {
    const base =
      periodValue.length >= 10
        ? periodValue
        : periodValue.length === 7
          ? `${periodValue}-01`
          : periodValue.length === 4
            ? `${periodValue}-01-01`
            : today();
    // Narrowing to a day inside the current month lands on today, not the 1st.
    const day = base.slice(0, 7) === today().slice(0, 7) ? today() : base;
    setPeriod(next);
    setPeriodValue(next === "day" ? day : next === "month" ? base.slice(0, 7) : base.slice(0, 4));
  }
  const [branchFilter, setBranchFilter] = useState("ALL");
  const years = yearOptions(transactions);
  const [comparisonYear, setComparisonYear] = useState(String(Number(currentYear) - 1));
  const [commissionRows, setCommissionRows] = useState<CourseCommissionReportRow[]>([]);
  const selectedYear = period === "year" ? periodValue : periodValue.slice(0, 4);
  const selectedBounds = periodBounds(period, periodValue);

  useEffect(() => {
    void getCourseCommissionReport(selectedBounds.from, selectedBounds.to)
      .then(setCommissionRows)
      .catch(() => setCommissionRows([]));
  }, [selectedBounds.from, selectedBounds.to]);
  const commissionTotals = commissionRows.reduce((a, r) => ({
    generated: a.generated + r.commissionGenerated,
    gross: a.gross + r.grossAllocated,
    ownerNet: a.ownerNet + r.ownerNetReleased,
    fee: a.fee + r.treatmentFeeEarned,
    outstanding: a.outstanding + r.outstandingPool,
    variable: a.variable + r.totalVariablePay,
  }), { generated: 0, gross: 0, ownerNet: 0, fee: 0, outstanding: 0, variable: 0 });

  const accessibleTransactions = useMemo(
    () => transactions.filter((t) => t.status === "COMPLETED" && (branchFilter === "ALL" ? isAccessible(t.branchId) : t.branchId === branchFilter)),
    [transactions, branchFilter, isAccessible]
  );
  const periodTransactions = accessibleTransactions.filter((t) => localDate(t.date) >= selectedBounds.from && localDate(t.date) <= selectedBounds.to);
  const totalSales = periodTransactions.reduce((sum, t) => sum + t.total, 0);

  const annualComparison = useMemo(() => {
    return monthNames.map((month, index) => {
      const monthNumber = String(index + 1).padStart(2, "0");
      const totalFor = (year: string) => accessibleTransactions
        .filter((t) => localDate(t.date).slice(0, 7) === `${year}-${monthNumber}`)
        .reduce((sum, t) => sum + t.total, 0);
      return { month, selected: totalFor(selectedYear), comparison: totalFor(comparisonYear) };
    });
  }, [accessibleTransactions, selectedYear, comparisonYear]);

  const activeCustomerIds = new Set(periodTransactions.map((t) => t.patientId));
  const periodPatients = patients.filter((p) => activeCustomerIds.has(p.id));
  const newCustomers = periodPatients.filter((p) => p.createdAt >= selectedBounds.from).length;
  const oldCustomers = Math.max(periodPatients.length - newCustomers, 0);
  const maleCustomers = periodPatients.filter((p) => p.gender === "MALE").length;
  const femaleCustomers = periodPatients.filter((p) => p.gender === "FEMALE").length;
  const branchCounts = branches
    .filter((branch) => branchFilter === "ALL" ? isAccessible(branch.id) : branch.id === branchFilter)
    .map((branch) => ({ name: branch.name, count: periodPatients.filter((p) => p.registrationBranchId === branch.id).length }))
    .filter((branch) => branch.count > 0);
  const branchSales = branches
    .filter((branch) => branchFilter === "ALL" ? isAccessible(branch.id) : branch.id === branchFilter)
    .map((branch) => ({
      name: branch.name,
      sales: periodTransactions.filter((t) => t.branchId === branch.id).reduce((sum, t) => sum + t.total, 0),
    }))
    .filter((branch) => branch.sales > 0);

  return (
    <>
      <PageHeader title="Dashboard" description="Sales and customer overview" />
      <div className="motion-rise-in motion-delay-1 mb-5 flex flex-wrap items-center gap-2">
        <Select value={period} onValueChange={(value) => changePeriod(value as Period)}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="day">Daily</SelectItem>
            <SelectItem value="month">Monthly</SelectItem>
            <SelectItem value="year">Yearly</SelectItem>
          </SelectContent>
        </Select>
        <Input type={period === "year" ? "number" : period === "month" ? "month" : "date"} value={periodValue} onChange={(e) => setPeriodValue(e.target.value)} className="w-40" />
        <BranchFilterSelect value={branchFilter} onValueChange={setBranchFilter} className="w-48" />
      </div>

      <div className="motion-rise-in motion-delay-1 mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label={`${period === "day" ? "Daily" : period === "month" ? "Monthly" : "Yearly"} Sales`} value={formatCurrency(totalSales)} icon={Wallet} tone="primary" />
        <StatCard label="Customers" value={String(periodPatients.length)} icon={Users} tone="info" />
        <StatCard label="New Customers" value={String(newCustomers)} icon={UserPlus} tone="success" />
      </div>

      <div className="motion-rise-in motion-delay-2 mb-5 rounded-xl border border-border bg-card p-5">
        <h2 className="mb-1 text-sm font-semibold text-foreground">Course Commission</h2>
        <p className="mb-4 text-xs text-muted-foreground">Commission generated and released from Course visits in the selected period</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatCard label="Generated" value={formatCurrency(commissionTotals.generated)} icon={Wallet} tone="primary" />
          <StatCard label="Gross Allocated" value={formatCurrency(commissionTotals.gross)} icon={Wallet} tone="info" />
          <StatCard label="Owner Net" value={formatCurrency(commissionTotals.ownerNet)} icon={Wallet} tone="success" />
          <StatCard label="Treatment Fee" value={formatCurrency(commissionTotals.fee)} icon={Wallet} tone="warning" />
          <StatCard label="Outstanding" value={formatCurrency(commissionTotals.outstanding)} icon={Wallet} tone="warning" />
          <StatCard label="Variable Pay" value={formatCurrency(commissionTotals.variable)} icon={Wallet} tone="success" />
        </div>
      </div>

      <div className="motion-rise-in motion-delay-2 mb-5 rounded-xl border border-border bg-card p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-sm font-semibold text-foreground">Sales comparison by month</h2><p className="text-xs text-muted-foreground">Compare two years month by month</p></div>
          <Select value={comparisonYear} onValueChange={setComparisonYear}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>{years.map((year) => <SelectItem key={year} value={year}>{year}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={annualComparison} margin={{ left: 8, right: 12, top: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="month" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} width={64} /><Tooltip formatter={(value) => formatCurrency(Number(value))} /><Legend />
            <Line name={selectedYear} type="monotone" dataKey="selected" stroke="var(--chart-1)" strokeWidth={2.5} dot={{ r: 3 }} />
            <Line name={comparisonYear} type="monotone" dataKey="comparison" stroke="var(--chart-2)" strokeWidth={2.5} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="motion-rise-in motion-delay-3 mb-5 rounded-xl border border-border bg-card p-5">
        <h2 className="mb-1 text-sm font-semibold text-foreground">Sales by branch</h2>
        <p className="mb-3 text-xs text-muted-foreground">Revenue from completed checkouts in the selected period</p>
        {branchSales.length ? (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={branchSales} margin={{ left: 0, right: 12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} width={64} />
              <Tooltip formatter={(value) => formatCurrency(Number(value))} />
              <Bar dataKey="sales" name="Sales" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="py-16 text-center text-sm text-muted-foreground">No sales data for this period</p>
        )}
      </div>

      <div className="motion-rise-in motion-delay-3 grid gap-5 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-1 text-sm font-semibold text-foreground">Customers by branch</h2><p className="mb-3 text-xs text-muted-foreground">Customers with completed sales in the selected period</p>
          {branchCounts.length ? <ResponsiveContainer width="100%" height={220}><BarChart data={branchCounts} margin={{ left: 0, right: 10 }}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey="count" name="Customers" fill="var(--chart-1)" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer> : <p className="py-16 text-center text-sm text-muted-foreground">No customer data for this period</p>}
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-4 text-sm font-semibold text-foreground">Customer breakdown</h2>
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Returning Customers" value={String(oldCustomers)} icon={UserRound} tone="warning" />
            <StatCard label="New Customers" value={String(newCustomers)} icon={UserPlus} tone="success" />
            <StatCard label="Male" value={String(maleCustomers)} icon={Users} tone="info" />
            <StatCard label="Female" value={String(femaleCustomers)} icon={Users} tone="primary" />
          </div>
        </div>
      </div>
    </>
  );
}
