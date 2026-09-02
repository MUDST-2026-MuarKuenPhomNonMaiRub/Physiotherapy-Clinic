"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useClinicStore } from "@/lib/store/clinic-store";
import { useBranchScope } from "@/lib/auth/use-branch-scope";
import { useReportScope } from "@/lib/auth/use-report-scope";
import { getCommissionRecords, today } from "@/lib/domain";
import { formatCurrency, formatDate } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { ReportsNav } from "@/components/reports/reports-nav";
import { ScopeNotice } from "@/components/reports/scope-notice";
import { StatCard } from "@/components/shared/stat-card";
import { BranchFilterSelect } from "@/components/shared/branch-filter-select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Percent, Stethoscope, Wallet } from "lucide-react";


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

export default function CommissionReportPage() {
  const transactions = useClinicStore((s) => s.transactions);
  const staff = useClinicStore((s) => s.staff);
  const { isAccessible } = useBranchScope();
  const { seesEveryone, ownStaffId, ownName } = useReportScope();

  const [range] = useState(defaultRange);
  const [dateFrom, setDateFrom] = useState(range.from);
  const [dateTo, setDateTo] = useState(range.to);
  const [branchFilter, setBranchFilter] = useState("ALL");
  const [staffFilter, setStaffFilter] = useState("ALL");

  // "commission.view.own" — a physiotherapist sees their own earnings only.
  const effectiveStaffFilter = seesEveryone ? staffFilter : ownStaffId ?? "__none__";

  const records = useMemo(() => {
    return getCommissionRecords(transactions)
      .filter((r) => (branchFilter === "ALL" ? isAccessible(r.branchId) : r.branchId === branchFilter))
      .filter((r) => effectiveStaffFilter === "ALL" || r.staffId === effectiveStaffFilter)
      .filter((r) => r.date.slice(0, 10) >= dateFrom && r.date.slice(0, 10) <= dateTo);
  }, [transactions, branchFilter, effectiveStaffFilter, dateFrom, dateTo, isAccessible]);

  const active = records.filter((r) => !r.reversed);
  const treatmentTotal = active.filter((r) => r.type === "TREATMENT").reduce((s, r) => s + r.amount, 0);
  const salesTotal = active.filter((r) => r.type === "SALES").reduce((s, r) => s + r.amount, 0);
  const activeTotal = treatmentTotal + salesTotal;

  return (
    <>
      <PageHeader
        title="Commission"
        description={
          seesEveryone
            ? "Commission earned by staff across treatment and sales"
            : "Your commission across treatment and sales"
        }
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
        <StatCard label="Treatment Commission" value={formatCurrency(treatmentTotal)} icon={Stethoscope} tone="success" />
        <StatCard label="Sales Commission" value={formatCurrency(salesTotal)} icon={Wallet} tone="info" />
        <StatCard label="Total Commission (active)" value={formatCurrency(activeTotal)} icon={Percent} tone="primary" />
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {seesEveryone && <TableHead>Staff</TableHead>}
                <TableHead>Transaction</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Treating / Sales</TableHead>
                <TableHead>Rule</TableHead>
                <TableHead className="text-right">Commission Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((r) => {
                const s = staff.find((st) => st.id === r.staffId);
                return (
                  <TableRow key={r.id}>
                    {seesEveryone && <TableCell className="font-medium text-foreground">{s?.name}</TableCell>}
                    <TableCell>
                      <Link href={`/transactions/${r.transactionId}`} className="font-mono text-xs text-primary hover:underline">
                        {r.transactionNo}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(r.date)}</TableCell>
                    <TableCell><Badge variant="outline" className="font-normal">{r.type === "TREATMENT" ? "Treating" : "Sales"}</Badge></TableCell>
                    <TableCell className="text-muted-foreground">{r.ruleName}</TableCell>
                    <TableCell className={`text-right font-medium ${r.reversed ? "text-muted-foreground line-through" : "text-foreground"}`}>
                      {formatCurrency(r.amount)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </>
  );
}
