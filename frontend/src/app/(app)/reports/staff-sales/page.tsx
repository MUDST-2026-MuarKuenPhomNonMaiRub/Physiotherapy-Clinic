"use client";

import { useMemo, useState } from "react";
import { today } from "@/lib/domain";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Award, Receipt, Wallet } from "lucide-react";
import { useClinicStore } from "@/lib/store/clinic-store";
import { useBranchScope } from "@/lib/auth/use-branch-scope";
import { useReportScope } from "@/lib/auth/use-report-scope";
import { formatCurrency } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { ReportsNav } from "@/components/reports/reports-nav";
import { ScopeNotice } from "@/components/reports/scope-notice";
import { StatCard } from "@/components/shared/stat-card";
import { BranchFilterSelect } from "@/components/shared/branch-filter-select";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";


/** Reports open on the last 6 weeks, ending today. */
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

export default function StaffSalesReportPage() {
  const transactions = useClinicStore((s) => s.transactions);
  const staff = useClinicStore((s) => s.staff);
  const { isAccessible } = useBranchScope();
  const { seesEveryone, ownStaffId, ownName } = useReportScope();

  const [range] = useState(defaultRange);
  const [dateFrom, setDateFrom] = useState(range.from);
  const [dateTo, setDateTo] = useState(range.to);
  const [branchFilter, setBranchFilter] = useState("ALL");
  const [staffFilter, setStaffFilter] = useState("ALL");

  // A physiotherapist only ever sees their own line, whatever the filter says.
  const effectiveStaffFilter = seesEveryone ? staffFilter : ownStaffId ?? "__none__";

  const filtered = useMemo(
    () =>
      transactions
        .filter((t) => t.status === "COMPLETED" && t.salespersonId)
        .filter((t) => (branchFilter === "ALL" ? isAccessible(t.branchId) : t.branchId === branchFilter))
        .filter((t) => effectiveStaffFilter === "ALL" || t.salespersonId === effectiveStaffFilter)
        .filter((t) => t.date.slice(0, 10) >= dateFrom && t.date.slice(0, 10) <= dateTo),
    [transactions, branchFilter, effectiveStaffFilter, dateFrom, dateTo, isAccessible]
  );

  const rows = useMemo(() => {
    const map = new Map<string, { staffId: string; transactions: number; courseSales: number; singleVisitSales: number }>();
    for (const t of filtered) {
      const id = t.salespersonId!;
      if (!map.has(id)) map.set(id, { staffId: id, transactions: 0, courseSales: 0, singleVisitSales: 0 });
      const row = map.get(id)!;
      row.transactions += 1;
      if (t.type === "COURSE_PURCHASE" || t.type === "MIXED") row.courseSales += t.total;
      else row.singleVisitSales += t.total;
    }
    return Array.from(map.values())
      .map((r) => ({ ...r, total: r.courseSales + r.singleVisitSales, staffMember: staff.find((s) => s.id === r.staffId) }))
      .sort((a, b) => b.total - a.total);
  }, [filtered, staff]);

  const totalSales = rows.reduce((s, r) => s + r.total, 0);
  const totalTransactions = rows.reduce((s, r) => s + r.transactions, 0);
  const topPerformer = rows[0];

  return (
    <>
      <PageHeader
        title="Staff Sales"
        description={seesEveryone ? "Sales performance by staff member" : "Your sales performance"}
      />
      <ReportsNav />
      {!seesEveryone && <ScopeNotice name={ownName} />}

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-40" />
        <span className="text-sm text-muted-foreground">to</span>
        <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-40" />
        <BranchFilterSelect value={branchFilter} onValueChange={setBranchFilter} className="w-44" />
        {seesEveryone && (
          <Select value={staffFilter} onValueChange={setStaffFilter}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Staff" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Staff</SelectItem>
              {staff.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Total Sales" value={formatCurrency(totalSales)} icon={Wallet} tone="primary" />
        <StatCard label="Total Transactions" value={String(totalTransactions)} icon={Receipt} tone="info" />
        <StatCard
          label={seesEveryone ? "Top Performer" : "Course Sales"}
          value={seesEveryone ? topPerformer?.staffMember?.name ?? "—" : formatCurrency(rows[0]?.courseSales ?? 0)}
          icon={Award}
          tone="success"
        />
      </div>

      {seesEveryone && rows.length > 0 && (
        <div className="mb-5 rounded-xl border border-border bg-card p-5">
          <h3 className="mb-2 text-sm font-semibold text-foreground">Sales by Staff</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={rows.map((r) => ({ name: r.staffMember?.name ?? "—", total: r.total }))} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
              <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" width={56} />
              <Tooltip formatter={(v) => formatCurrency(Number(v))} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="total" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Staff</TableHead>
                <TableHead className="text-center">Transactions</TableHead>
                <TableHead className="text-right">Course Sales</TableHead>
                <TableHead className="text-right">Single Visit Sales</TableHead>
                <TableHead className="text-right">Total Sales</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.staffId}>
                  <TableCell className="font-medium text-foreground">{r.staffMember?.name}</TableCell>
                  <TableCell className="text-center">{r.transactions}</TableCell>
                  <TableCell className="text-right">{formatCurrency(r.courseSales)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(r.singleVisitSales)}</TableCell>
                  <TableCell className="text-right font-semibold text-foreground">{formatCurrency(r.total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </>
  );
}
