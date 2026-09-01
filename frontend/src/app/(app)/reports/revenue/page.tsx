"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useClinicStore } from "@/lib/store/clinic-store";
import { useBranchScope } from "@/lib/auth/use-branch-scope";
import { formatCurrency, formatDate } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { ReportsNav } from "@/components/reports/reports-nav";
import { BranchFilterSelect } from "@/components/shared/branch-filter-select";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TrendingUp, Wallet } from "lucide-react";

export default function RevenueReportPage() {
  const transactions = useClinicStore((s) => s.transactions);
  const { isAccessible } = useBranchScope();

  const [dateFrom, setDateFrom] = useState("2026-07-01");
  const [dateTo, setDateTo] = useState("2026-08-12");
  const [branchFilter, setBranchFilter] = useState("ALL");

  const filtered = useMemo(
    () =>
      transactions
        .filter((t) => t.status === "COMPLETED")
        .filter((t) => (branchFilter === "ALL" ? isAccessible(t.branchId) : t.branchId === branchFilter))
        .filter((t) => t.date.slice(0, 10) >= dateFrom && t.date.slice(0, 10) <= dateTo),
    [transactions, branchFilter, dateFrom, dateTo, isAccessible]
  );

  const totalRevenue = filtered.reduce((s, t) => s + t.total, 0);
  const courseRevenue = filtered.filter((t) => t.type === "COURSE_PURCHASE" || t.type === "MIXED").reduce((s, t) => s + t.total, 0);
  const singleVisitRevenue = filtered.filter((t) => t.type === "SINGLE_VISIT" || t.type === "ASSESSMENT").reduce((s, t) => s + t.total, 0);

  const byDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of filtered) {
      const d = t.date.slice(0, 10);
      map.set(d, (map.get(d) ?? 0) + t.total);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  return (
    <>
      <PageHeader title="Revenue" description="Revenue breakdown by service type and time" />
      <ReportsNav />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-40" />
        <span className="text-sm text-muted-foreground">to</span>
        <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-40" />
        <BranchFilterSelect value={branchFilter} onValueChange={setBranchFilter} className="w-48" />
      </div>

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Total Revenue" value={formatCurrency(totalRevenue)} icon={Wallet} tone="primary" />
        <StatCard label="Course Revenue" value={formatCurrency(courseRevenue)} icon={TrendingUp} tone="success" />
        <StatCard label="Single Visit Revenue" value={formatCurrency(singleVisitRevenue)} icon={TrendingUp} tone="warning" />
      </div>

      <div className="mb-5 rounded-xl border border-border bg-card p-5">
        <h3 className="mb-2 text-sm font-semibold text-foreground">Revenue Trend</h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={byDate.map(([date, revenue]) => ({ date: formatDate(date), revenue }))} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
            <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" width={56} />
            <Tooltip formatter={(v) => formatCurrency(Number(v))} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
            <Bar dataKey="revenue" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Transactions</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byDate.map(([date, revenue]) => (
                <TableRow key={date}>
                  <TableCell>{formatDate(date)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{filtered.filter((t) => t.date.slice(0, 10) === date).length}</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(revenue)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </>
  );
}
