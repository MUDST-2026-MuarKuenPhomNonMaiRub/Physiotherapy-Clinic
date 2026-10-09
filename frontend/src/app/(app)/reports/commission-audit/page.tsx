"use client";

import { useEffect, useState } from "react";
import { FileSearch, Search } from "lucide-react";
import { listCommissionAudit } from "@/lib/api/clinic-api";
import { useClinicStore } from "@/lib/store/clinic-store";
import { localDate } from "@/lib/domain";
import { formatDateTime } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { CommissionAuditLog } from "@/types";
import { toast } from "sonner";

export default function CommissionAuditPage() {
  const users = useClinicStore((s) => s.users);
  const branches = useClinicStore((s) => s.branches);
  const [rows, setRows] = useState<CommissionAuditLog[]>([]);
  const [query, setQuery] = useState("");
  const [actionFilter, setActionFilter] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    const from = dateFrom ? `${dateFrom}T00:00:00+07:00` : undefined;
    const to = dateTo ? `${dateTo}T23:59:59.999+07:00` : undefined;
    void listCommissionAudit({ action: actionFilter, from, to, limit: 200 }).then(setRows).catch((error) =>
      toast.error(error instanceof Error ? error.message : "Could not load commission audit"));
  }, [actionFilter, dateFrom, dateTo]);

  const actorName = (id?: string) => (id ? users.find((u) => u.id === id)?.displayName ?? `#${id}` : "—");
  const branchName = (id?: string) => (id ? branches.find((b) => b.id === id)?.name ?? `#${id}` : "—");
  const actions = [...new Set(rows.map((row) => row.action))].sort();
  const term = query.trim().toLocaleLowerCase();
  const visible = rows
    .filter((row) => actionFilter === "ALL" || row.action === actionFilter)
    .filter((row) => !dateFrom || localDate(row.occurredAt) >= dateFrom)
    .filter((row) => !dateTo || localDate(row.occurredAt) <= dateTo)
    .filter((row) =>
      !term ||
      [actorName(row.actorUserId), branchName(row.branchId), row.action, row.entityType, row.entityId, row.reason]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase()
        .includes(term)
    );

  return (
    <>
      <PageHeader title="Commission Audit" description="Immutable history of commission configuration, closing overrides and financial corrections" />
      {rows.length === 0 ? (
        <EmptyState icon={FileSearch} title="No commission audit records" description="New configuration changes and overrides will appear here." />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="relative min-w-52 flex-1 sm:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search actor, branch, entity or reason..." className="pl-9" />
            </div>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All actions</SelectItem>
                {actions.map((action) => <SelectItem key={action} value={action}>{action}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} aria-label="Audit from date" className="w-36" />
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} aria-label="Audit to date" className="w-36" />
            <p className="ml-auto text-sm text-muted-foreground">{visible.length} records</p>
          </div>
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
            <div className="overflow-x-auto">
              <Table className="min-w-[1100px]">
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Actor</TableHead><TableHead>Branch</TableHead><TableHead>Action</TableHead><TableHead>Entity</TableHead><TableHead>Before</TableHead><TableHead>After</TableHead><TableHead>Reason</TableHead></TableRow></TableHeader>
                <TableBody>
                  {visible.length === 0 && (
                    <TableRow><TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">No matching records</TableCell></TableRow>
                  )}
                  {visible.map((row) => <TableRow key={row.id}>
                    <TableCell className="text-muted-foreground">{formatDateTime(row.occurredAt)}</TableCell>
                    <TableCell>{actorName(row.actorUserId)}</TableCell>
                    <TableCell>{branchName(row.branchId)}</TableCell>
                    <TableCell className="font-medium text-foreground">{row.action}</TableCell>
                    <TableCell>{row.entityType} #{row.entityId}</TableCell>
                    <TableCell className="max-w-[180px] truncate font-mono text-xs">{row.beforeData ? JSON.stringify(row.beforeData) : "—"}</TableCell>
                    <TableCell className="max-w-[180px] truncate font-mono text-xs">{row.afterData ? JSON.stringify(row.afterData) : "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{row.reason || "—"}</TableCell>
                  </TableRow>)}
                </TableBody>
              </Table>
            </div>
          </div>
        </>
      )}
    </>
  );
}
