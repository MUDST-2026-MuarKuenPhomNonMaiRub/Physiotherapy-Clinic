"use client";

import { useEffect, useState } from "react";
import { FileSearch } from "lucide-react";
import { listCommissionAudit } from "@/lib/api/clinic-api";
import { formatDateTime } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { CommissionAuditLog } from "@/types";
import { toast } from "sonner";

export default function CommissionAuditPage() {
  const [rows, setRows] = useState<CommissionAuditLog[]>([]);

  useEffect(() => {
    void listCommissionAudit().then(setRows).catch((error) =>
      toast.error(error instanceof Error ? error.message : "Could not load commission audit"));
  }, []);

  return (
    <>
      <PageHeader title="Commission Audit" description="Immutable history of commission configuration, closing overrides and financial corrections" />
      {rows.length === 0 ? (
        <EmptyState icon={FileSearch} title="No commission audit records" description="New configuration changes and overrides will appear here." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
          <Table>
            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Action</TableHead><TableHead>Entity</TableHead><TableHead>Reason</TableHead></TableRow></TableHeader>
            <TableBody>{rows.map((row) => <TableRow key={row.id}>
              <TableCell className="text-muted-foreground">{formatDateTime(row.occurredAt)}</TableCell>
              <TableCell className="font-medium text-foreground">{row.action}</TableCell>
              <TableCell>{row.entityType} #{row.entityId}</TableCell>
              <TableCell className="text-muted-foreground">{row.reason ?? "-"}</TableCell>
            </TableRow>)}</TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
