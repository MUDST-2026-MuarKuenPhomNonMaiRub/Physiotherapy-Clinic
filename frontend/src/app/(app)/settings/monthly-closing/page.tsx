"use client";

import { useEffect, useState } from "react";
import { CalendarCheck2, Lock } from "lucide-react";
import { toast } from "sonner";
import { closeMonth, listClosingHistory, previewClosing, overrideClosing } from "@/lib/api/clinic-api";
import { formatCurrency, formatDate } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ClosingHistoryRow, ClosingPreviewRow } from "@/types";

function toMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function currentMonth() {
  return toMonthKey(new Date());
}

/** The most recent month that is over — the one the screen opens on, since it is the one that can be closed. */
function previousMonth() {
  const now = new Date();
  return toMonthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));
}

/**
 * Event B of the requirement: preview the suggested tier/rate for every
 * Seller with a course sale this month, then freeze it. Closing never
 * touches a month already closed — see closedEmployees in the result and
 * "alreadyClosed" on each preview row.
 */
export default function MonthlyClosingPage() {
  const [month, setMonth] = useState(previousMonth());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [preview, setPreview] = useState<ClosingPreviewRow[]>([]);
  const [history, setHistory] = useState<ClosingHistoryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [closing, setClosing] = useState(false);
  const [closeReason, setCloseReason] = useState("");
  const [overrideRow, setOverrideRow] = useState<ClosingHistoryRow | null>(null);
  const [overrideRate, setOverrideRate] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [overriding, setOverriding] = useState(false);

  async function loadPreview() {
    setLoading(true);
    try {
      setPreview(await previewClosing(month));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load the preview");
    } finally {
      setLoading(false);
    }
  }

  async function loadHistory() {
    try {
      setHistory(await listClosingHistory());
    } catch {
      // History is supplementary context here; a failure to load it is silent.
    }
  }

  useEffect(() => {
    // loadPreview() only sets state after its own await, inside the fetch's
    // resolution — not synchronously on this render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadPreview();
    void loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  async function runClose() {
    const earlyClose = month === currentMonth();
    if (earlyClose && !closeReason.trim()) {
      toast.error("A reason is required for an early close");
      return;
    }
    setClosing(true);
    try {
      const result = await closeMonth(month, earlyClose, closeReason.trim() || undefined);
      setConfirmOpen(false);
      setCloseReason("");
      toast.success(`Closed commission for ${result.closedEmployees} employee(s)`);
      await loadPreview();
      await loadHistory();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not close the month");
    } finally {
      setClosing(false);
    }
  }

  async function runOverride() {
    if (!overrideRow) return;
    const rate = Number(overrideRate);
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
      toast.error("Rate must be between 0 and 100 percent");
      return;
    }
    if (!overrideReason.trim()) {
      toast.error("A reason is required");
      return;
    }
    setOverriding(true);
    try {
      await overrideClosing(overrideRow.id, rate / 100, overrideReason.trim());
      toast.success("Locked rate overridden and recorded in audit");
      setOverrideRow(null);
      await loadHistory();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not override the locked rate");
    } finally {
      setOverriding(false);
    }
  }

  const closable = preview.filter((row) => !row.alreadyClosed);
  // The current month can be closed early by the Admin through the same
  // button, but the API requires a reason and records an audit event.
  const monthStillRunning = month === currentMonth();
  const monthInFuture = month > currentMonth();
  const uncovered = closable.filter((row) => row.suggestedRate === null);
  const totalSales = closable.reduce((sum, row) => sum + row.monthlySales, 0);
  const totalPool = closable.reduce((sum, row) => sum + (row.suggestedPool ?? 0), 0);
  const canClose = !closing && closable.length > 0 && !monthInFuture && uncovered.length === 0;
  const earlyClose = monthStillRunning;

  return (
    <>
      <PageHeader
        title="Monthly Closing"
        description="Freezes every Seller's course-sales tier for the month onto every course they sold — after this, a course's rate never moves, no matter how much they sell later."
        actions={
          <Button onClick={() => setConfirmOpen(true)} disabled={!canClose}>
            <Lock className="h-4 w-4" /> {closing ? "Closing..." : earlyClose ? `Close Early ${month}` : `Close ${month}`}
          </Button>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Input type="month" value={month} max={currentMonth()} onChange={(e) => setMonth(e.target.value)} className="w-44" />
        {monthStillRunning && (
          <p className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-1.5 text-xs text-[#8A5A00]">
            {month} is still running. Closing it now is an Admin early close and freezes the tier on sales recorded so far.
          </p>
        )}
        {!monthStillRunning && uncovered.length > 0 && (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-xs text-destructive">
            No commission tier covers the sales of {uncovered.map((row) => row.employeeName).join(", ")}. Fix the tier
            table under Commission Tiers before closing — a missing tier is never treated as 0%.
          </p>
        )}
      </div>

      {!loading && preview.length === 0 ? (
        <EmptyState icon={CalendarCheck2} title="No provisional course sales this month" description="Nothing to close yet — a Seller needs at least one course sale still in PROVISIONAL status." />
      ) : (
        <div className="mb-8 overflow-hidden rounded-xl border border-border bg-card shadow-xs">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Seller</TableHead>
                <TableHead className="text-right">Monthly Course Sales</TableHead>
                <TableHead className="text-right">Suggested Rate</TableHead>
                <TableHead className="text-right">Suggested Pool</TableHead>
                <TableHead>Scheme</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {preview.map((row) => (
                <TableRow key={row.employeeId}>
                  <TableCell className="font-medium text-foreground">{row.employeeName}</TableCell>
                  <TableCell className="text-right">{formatCurrency(row.monthlySales)}</TableCell>
                  <TableCell className="text-right font-mono">
                    {row.suggestedRate === null ? (
                      <span className="text-destructive">No tier</span>
                    ) : (
                      `${(row.suggestedRate * 100).toFixed(2)}%`
                    )}
                  </TableCell>
                  <TableCell className="text-right">{row.suggestedPool === null ? "—" : formatCurrency(row.suggestedPool)}</TableCell>
                  <TableCell className="font-mono text-xs">{row.schemeId ? `${row.schemeId} / v${row.schemeVersion ?? "-"}` : "-"}</TableCell>
                  <TableCell>
                    {row.alreadyClosed ? (
                      <Badge variant="outline" className="bg-muted">Closed</Badge>
                    ) : (
                      <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">Open</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <h2 className="mb-3 text-sm font-semibold text-foreground">Closing History</h2>
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Month</TableHead>
              <TableHead>Employee</TableHead>
              <TableHead className="text-right">Monthly Sales</TableHead>
              <TableHead className="text-right">Locked Rate</TableHead>
              <TableHead>Scheme</TableHead>
              <TableHead className="text-right">Calculated Rate</TableHead>
              <TableHead>Closed At</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {history.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{formatDate(row.closingMonth)}</TableCell>
                <TableCell className="font-medium text-foreground">{row.employeeName}</TableCell>
                <TableCell className="text-right">{formatCurrency(row.monthlyCourseSales)}</TableCell>
                <TableCell className="text-right font-mono">{(row.lockedCommissionRate * 100).toFixed(2)}%</TableCell>
                <TableCell className="font-mono text-xs">{row.schemeId ? `${row.schemeId} / v${row.schemeVersion ?? "-"}` : "-"}</TableCell>
                <TableCell className="text-right font-mono">{(row.calculatedCommissionRate * 100).toFixed(2)}%</TableCell>
                <TableCell className="text-muted-foreground">{row.closedAt ? formatDate(row.closedAt) : "-"}</TableCell>
                <TableCell>
                  <Button variant="outline" size="sm" onClick={() => { setOverrideRow(row); setOverrideRate(String((row.lockedCommissionRate * 100).toFixed(2))); setOverrideReason(""); }}>
                    Override
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={confirmOpen} onOpenChange={(open) => !open && !closing && setConfirmOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{earlyClose ? `Close commission early for ${month}?` : `Close commission for ${month}?`}</DialogTitle>
            <DialogDescription>
              {earlyClose
                ? "This freezes the tier using sales recorded so far. New course sales in this month will be blocked unless an Admin uses an audited override."
                : "This freezes the tier rate onto every course sold in this month and cannot be undone — a later correction needs an audited override."}
            </DialogDescription>
          </DialogHeader>
          {earlyClose && (
            <div className="space-y-1.5">
              <Label htmlFor="early-close-reason">Reason for early close</Label>
              <Textarea id="early-close-reason" value={closeReason} onChange={(e) => setCloseReason(e.target.value)} placeholder="Explain why Finance is closing this month early" />
            </div>
          )}
          <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Sellers to close</span><span className="font-medium">{closable.length}</span></div>
            <div className="mt-1 flex justify-between"><span className="text-muted-foreground">Course sales</span><span className="font-medium">{formatCurrency(totalSales)}</span></div>
            <div className="mt-1 flex justify-between"><span className="text-muted-foreground">Commission pool to freeze</span><span className="font-medium">{formatCurrency(totalPool)}</span></div>
          </div>
          <ul className="max-h-40 space-y-1 overflow-y-auto text-sm">
            {closable.map((row) => (
              <li key={row.employeeId} className="flex justify-between gap-3">
                <span>{row.employeeName}</span>
                <span className="font-mono text-muted-foreground">
                  {formatCurrency(row.monthlySales)} · {row.suggestedRate === null ? "—" : `${(row.suggestedRate * 100).toFixed(2)}%`}
                </span>
              </li>
            ))}
          </ul>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={closing}>Cancel</Button>
            <Button onClick={() => void runClose()} disabled={closing}>
              <Lock className="h-4 w-4" /> {closing ? "Closing..." : earlyClose ? "Close Early" : "Close Month"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={overrideRow !== null} onOpenChange={(open) => !open && setOverrideRow(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Override Locked Rate</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            This changes the locked rate for {overrideRow?.employeeName} in {overrideRow?.closingMonth}. The change is permanent and audited.
          </p>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>New rate (%)</Label><Input type="number" min="0" max="100" step="0.01" value={overrideRate} onChange={(e) => setOverrideRate(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Reason</Label><Textarea value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} placeholder="Explain why Finance is correcting this rate" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOverrideRow(null)}>Cancel</Button>
            <Button onClick={() => void runOverride()} disabled={overriding}>{overriding ? "Saving..." : "Save Override"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
