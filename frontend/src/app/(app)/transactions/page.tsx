"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Receipt, Search } from "lucide-react";
import { useClinicStore } from "@/lib/store/clinic-store";
import { useSession } from "@/lib/auth/use-session";
import { useBranchScope } from "@/lib/auth/use-branch-scope";
import { getPatientFullNameTh, searchPatients } from "@/lib/domain";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { TablePagination, paginate, usePageReset } from "@/components/shared/table-pagination";
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
import type { TransactionStatus, TransactionType } from "@/types";

const typeOptions: { value: TransactionType | "ALL"; label: string }[] = [
  { value: "ALL", label: "All Types" },
  { value: "ASSESSMENT", label: "Assessment" },
  { value: "SINGLE_VISIT", label: "Single Visit" },
  { value: "COURSE_PURCHASE", label: "Course Purchase" },
  { value: "COURSE_USAGE", label: "Course Usage" },
  { value: "MIXED", label: "Mixed" },
];

const typeStyle: Record<TransactionType, string> = {
  ASSESSMENT: "border-info/20 bg-info/10 text-info",
  SINGLE_VISIT: "border-primary/20 bg-primary/10 text-primary",
  COURSE_PURCHASE: "border-success/20 bg-success/10 text-success",
  COURSE_USAGE: "border-warning/20 bg-warning/10 text-warning",
  MIXED: "border-violet-200 bg-violet-50 text-violet-700",
};
const typeLabel: Record<TransactionType, string> = {
  ASSESSMENT: "Assessment",
  SINGLE_VISIT: "Single Visit",
  COURSE_PURCHASE: "Course Purchase",
  COURSE_USAGE: "Course Usage",
  MIXED: "Mixed",
};

export default function TransactionsPage() {
  const router = useRouter();
  const { activeBranchId, can } = useSession();
  const { isAccessible } = useBranchScope();
  const transactions = useClinicStore((s) => s.transactions);
  const patients = useClinicStore((s) => s.patients);
  const staff = useClinicStore((s) => s.staff);
  const paymentMethods = useClinicStore((s) => s.paymentMethods);

  const [query, setQuery] = useState("");
  const [branchFilter, setBranchFilter] = useState(activeBranchId ?? "ALL");
  const [typeFilter, setTypeFilter] = useState<TransactionType | "ALL">("ALL");
  const [paymentFilter, setPaymentFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState<TransactionStatus | "ALL">("ALL");
  const [staffFilter, setStaffFilter] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);

  const matchingPatientIds = useMemo(
    () => (query ? new Set(searchPatients(query, patients).map((p) => p.id)) : null),
    [query, patients]
  );

  const filtered = useMemo(() => {
    return transactions
      .filter((t) => !matchingPatientIds || matchingPatientIds.has(t.patientId))
      .filter((t) => (branchFilter === "ALL" ? isAccessible(t.branchId) : t.branchId === branchFilter))
      .filter((t) => typeFilter === "ALL" || t.type === typeFilter)
      .filter((t) => paymentFilter === "ALL" || t.paymentMethodId === paymentFilter)
      .filter((t) => statusFilter === "ALL" || t.status === statusFilter)
      .filter((t) => staffFilter === "ALL" || t.treatingStaffId === staffFilter || t.salespersonId === staffFilter)
      .filter((t) => !dateFrom || t.date.slice(0, 10) >= dateFrom)
      .filter((t) => !dateTo || t.date.slice(0, 10) <= dateTo)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [transactions, matchingPatientIds, branchFilter, typeFilter, paymentFilter, statusFilter, staffFilter, dateFrom, dateTo, isAccessible]);

  usePageReset(
    `${query}|${branchFilter}|${typeFilter}|${paymentFilter}|${statusFilter}|${staffFilter}|${dateFrom}|${dateTo}`,
    setPage
  );

  const pageItems = paginate(filtered, page);

  return (
    <>
      <PageHeader
        title="Transactions"
        description={can("transaction.void") ? "All billing transactions across branches" : "Read-only view of billing transactions"}
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Patient HN or name..." className="pl-9" />
        </div>
        <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-40" />
        <span className="text-sm text-muted-foreground">to</span>
        <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-40" />
        <p className="ml-auto text-sm text-muted-foreground">{filtered.length} transactions</p>
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <BranchFilterSelect value={branchFilter} onValueChange={setBranchFilter} className="w-44" />
        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as TransactionType | "ALL")}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            {typeOptions.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={paymentFilter} onValueChange={setPaymentFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Payment" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Payments</SelectItem>
            {paymentMethods.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as TransactionStatus | "ALL")}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Statuses</SelectItem>
            <SelectItem value="COMPLETED">Completed</SelectItem>
            <SelectItem value="VOID">Void</SelectItem>
          </SelectContent>
        </Select>
        <Select value={staffFilter} onValueChange={setStaffFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Staff" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Staff</SelectItem>
            {staff.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Receipt} title="No transactions found" description="Try adjusting your filters." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Transaction No.</TableHead>
                  <TableHead>Date / Time</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Payment Method</TableHead>
                  <TableHead>Salesperson</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageItems.map((t) => {
                  const patient = patients.find((p) => p.id === t.patientId);
                  const pm = paymentMethods.find((p) => p.id === t.paymentMethodId);
                  const sales = staff.find((s) => s.id === t.salespersonId);
                  return (
                    <TableRow key={t.id} className="cursor-pointer" onClick={() => router.push(`/transactions/${t.id}`)}>
                      <TableCell className="font-mono text-xs">{t.transactionNo}</TableCell>
                      <TableCell className="text-muted-foreground">{formatDateTime(t.date)}</TableCell>
                      <TableCell>
                        <p className="font-medium text-foreground">{patient ? getPatientFullNameTh(patient) : "—"}</p>
                        <p className="font-mono text-xs text-muted-foreground">{patient?.hn}</p>
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${typeStyle[t.type]}`}>
                          {typeLabel[t.type]}
                        </span>
                      </TableCell>
                      <TableCell className="font-medium">{formatCurrency(t.total)}</TableCell>
                      <TableCell className="text-muted-foreground">{pm?.name}</TableCell>
                      <TableCell className="text-muted-foreground">{sales?.name ?? "—"}</TableCell>
                      <TableCell><StatusBadge status={t.status} /></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <TablePagination page={page} totalItems={filtered.length} onPageChange={setPage} />
        </div>
      )}
    </>
  );
}
