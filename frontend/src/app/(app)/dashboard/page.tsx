"use client";

import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartPie, Coins, HandCoins, Hourglass, Landmark, Stethoscope, Users, UserPlus, UserRound, Wallet } from "lucide-react";
import { useClinicStore } from "@/lib/store/clinic-store";
import { useBranchScope } from "@/lib/auth/use-branch-scope";
import { formatCurrency, formatPeriod } from "@/lib/format";
import { useLanguage } from "@/components/i18n/language-provider";
import { addDays, localDate, today } from "@/lib/domain";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard, type SparklinePoint } from "@/components/shared/stat-card";
import { BranchFilterSelect } from "@/components/shared/branch-filter-select";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getCourseCommissionReport } from "@/lib/api/clinic-api";
import type { CourseCommissionReportRow, Patient, Transaction } from "@/types";

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

/** How many periods the card sparklines look back over, the selected one included. */
const sparklineLength: Record<Period, number> = { day: 14, month: 12, year: 5 };
const sparklineCaption: Record<Period, string> = {
  day: "Last 14 days",
  month: "Last 12 months",
  year: "Last 5 years",
};
const previousPeriodLabel: Record<Period, string> = {
  day: "vs previous day",
  month: "vs previous month",
  year: "vs previous year",
};
/** Used while the selected month or year is still running; a day never is. */
const previousToDateLabel: Record<Period, string> = {
  day: "vs previous day",
  month: "vs same days last month",
  year: "vs same days last year",
};

/** Whole days from one YYYY-MM-DD key to another, counted in local time like addDays. */
function daysBetween(from: string, to: string): number {
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  return Math.round((end.getTime() - start.getTime()) / 86_400_000);
}

/** The period `steps` before `value`, in the same YYYY-MM-DD / YYYY-MM / YYYY shape. */
function shiftPeriod(period: Period, value: string, steps: number): string {
  if (period === "day") return addDays(value, -steps);
  if (period === "month") {
    const [year, month] = value.split("-").map(Number);
    const d = new Date(year, month - 1 - steps, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
  return String(Number(value) - steps);
}

interface PeriodFigures {
  sales: number;
  customers: number;
  newCustomers: number;
}

/**
 * The headline figures for one period, counted the way the cards always have:
 * customers are patients with a completed sale in the period, and a new one is
 * a patient among them registered on or after the period's first day.
 */
function periodFigures(
  transactions: Transaction[],
  patientsById: Map<string, Patient>,
  bounds: { from: string; to: string }
): PeriodFigures {
  let sales = 0;
  const customerIds = new Set<string>();
  for (const t of transactions) {
    const day = localDate(t.date);
    if (day < bounds.from || day > bounds.to) continue;
    sales += t.total;
    customerIds.add(t.patientId);
  }
  let customers = 0;
  let newCustomers = 0;
  for (const id of customerIds) {
    const patient = patientsById.get(id);
    if (!patient) continue;
    customers += 1;
    if (patient.createdAt >= bounds.from) newCustomers += 1;
  }
  return { sales, customers, newCustomers };
}

/** No trend is shown without a previous figure to compare against. */
function trendOf(current: number, previous: number, label: string) {
  if (previous === 0) return undefined;
  const change = ((current - previous) / previous) * 100;
  const size = Math.abs(change);
  const shown = size < 10 ? size.toFixed(1) : String(Math.round(size));
  if (shown === "0.0") return { value: "0%", direction: "flat", label } as const;
  return { value: `${shown}%`, direction: change > 0 ? "up" : "down", label } as const;
}

const periodShape: Record<Period, RegExp> = {
  day: /^\d{4}-\d{2}-\d{2}$/,
  month: /^\d{4}-\d{2}$/,
  year: /^\d{4}$/,
};

/**
 * Last year is always offered: it is the comparison the page opens on, and a
 * clinic with no sales that year should see it as a zero line rather than an
 * empty picker.
 */
function yearOptions(transactions: { date: string }[]) {
  const years = new Set(transactions.map((t) => localDate(t.date).slice(0, 4)));
  const current = Number(today().slice(0, 4));
  years.add(String(current));
  years.add(String(current - 1));
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
  // What the box shows while it is being typed in. The figures follow
  // periodValue, the last complete entry, so a half-typed or cleared year
  // does not turn every card to zero.
  const [periodInput, setPeriodInput] = useState(periodValue);

  function changePeriodInput(value: string) {
    setPeriodInput(value);
    if (periodShape[period].test(value)) setPeriodValue(value);
  }

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
    const value = next === "day" ? day : next === "month" ? base.slice(0, 7) : base.slice(0, 4);
    setPeriod(next);
    setPeriodValue(value);
    setPeriodInput(value);
  }
  const [branchFilter, setBranchFilter] = useState("ALL");
  const years = yearOptions(transactions);
  const [comparisonYear, setComparisonYear] = useState(String(Number(currentYear) - 1));
  const [commissionRows, setCommissionRows] = useState<CourseCommissionReportRow[]>([]);
  const selectedYear = period === "year" ? periodValue : periodValue.slice(0, 4);
  const selectedBounds = periodBounds(period, periodValue);

  useEffect(() => {
    // A reply for a period the user has already moved away from is dropped,
    // so a slow earlier request cannot overwrite the newer figures.
    let active = true;
    void getCourseCommissionReport(selectedBounds.from, selectedBounds.to)
      .then((rows) => {
        if (active) setCommissionRows(rows);
      })
      .catch(() => {
        if (active) setCommissionRows([]);
      });
    return () => {
      active = false;
    };
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

  const { history, previous, trendLabel } = useMemo(() => {
    const patientsById = new Map(patients.map((p) => [p.id, p]));
    // The selected period and the ones before it, oldest first, for the sparklines.
    const length = sparklineLength[period];
    const history = Array.from({ length }, (_, i) => {
      const value = shiftPeriod(period, periodValue, length - 1 - i);
      return { period: value, ...periodFigures(accessibleTransactions, patientsById, periodBounds(period, value)) };
    });

    // A month or year still under way is compared with the same stretch of the
    // one before (1–5 Oct against 1–5 Sep), not with all of it — otherwise
    // every period would open on a steep fall that is only the calendar.
    const todayKey = today();
    const toDate = selectedBounds.from <= todayKey && todayKey < selectedBounds.to;
    const before = periodBounds(period, shiftPeriod(period, periodValue, 1));
    if (toDate) {
      const capped = addDays(before.from, daysBetween(selectedBounds.from, todayKey));
      if (capped < before.to) before.to = capped;
    }
    return {
      history,
      previous: periodFigures(accessibleTransactions, patientsById, before),
      trendLabel: toDate ? previousToDateLabel[period] : previousPeriodLabel[period],
    };
  }, [accessibleTransactions, patients, period, periodValue, selectedBounds.from, selectedBounds.to]);

  // The period names follow the language toggle.
  const { locale } = useLanguage();
  const sparklineOf = (
    figure: (h: (typeof history)[number]) => number,
    display: (h: (typeof history)[number]) => string
  ): SparklinePoint[] =>
    history.map((h) => ({ label: formatPeriod(period, h.period, locale), value: figure(h), display: display(h) }));

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
        <Input type={period === "year" ? "number" : period === "month" ? "month" : "date"} value={periodInput} onChange={(e) => changePeriodInput(e.target.value)} onBlur={() => setPeriodInput(periodValue)} className="w-40" />
        <BranchFilterSelect value={branchFilter} onValueChange={setBranchFilter} className="w-48" />
      </div>

      <div className="motion-rise-in motion-delay-1 mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          label={`${period === "day" ? "Daily" : period === "month" ? "Monthly" : "Yearly"} Sales`}
          value={formatCurrency(totalSales)}
          icon={Wallet}
          tone="primary"
          trend={trendOf(totalSales, previous.sales, trendLabel)}
          sparkline={sparklineOf((h) => h.sales, (h) => formatCurrency(h.sales))}
          sparklineCaption={sparklineCaption[period]}
        />
        <StatCard
          label="Customers"
          value={String(periodPatients.length)}
          icon={Users}
          tone="info"
          trend={trendOf(periodPatients.length, previous.customers, trendLabel)}
          sparkline={sparklineOf((h) => h.customers, (h) => String(h.customers))}
          sparklineCaption={sparklineCaption[period]}
        />
        <StatCard
          label="New Customers"
          value={String(newCustomers)}
          icon={UserPlus}
          tone="success"
          trend={trendOf(newCustomers, previous.newCustomers, trendLabel)}
          sparkline={sparklineOf((h) => h.newCustomers, (h) => String(h.newCustomers))}
          sparklineCaption={sparklineCaption[period]}
        />
      </div>

      <div className="motion-rise-in motion-delay-2 mb-5 rounded-xl border border-border bg-card p-5">
        <h2 className="mb-1 text-sm font-semibold text-foreground">Course Commission</h2>
        <p className="mb-4 text-xs text-muted-foreground">Commission generated and released from Course visits in the selected period</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatCard label="Generated" value={formatCurrency(commissionTotals.generated)} icon={Coins} tone="primary" />
          <StatCard label="Gross Allocated" value={formatCurrency(commissionTotals.gross)} icon={ChartPie} tone="info" />
          <StatCard label="Owner Net" value={formatCurrency(commissionTotals.ownerNet)} icon={Landmark} tone="success" />
          <StatCard label="Treatment Fee" value={formatCurrency(commissionTotals.fee)} icon={Stethoscope} tone="warning" />
          <StatCard label="Outstanding" value={formatCurrency(commissionTotals.outstanding)} icon={Hourglass} tone="warning" />
          <StatCard label="Variable Pay" value={formatCurrency(commissionTotals.variable)} icon={HandCoins} tone="success" />
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
