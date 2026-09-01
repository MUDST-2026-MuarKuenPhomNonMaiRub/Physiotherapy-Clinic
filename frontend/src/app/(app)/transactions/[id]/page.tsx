"use client";

import { use, useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Ban,
  CheckCircle2,
  CircleDot,
  Percent,
  Ticket,
  TriangleAlert,
} from "lucide-react";
import { useClinicStore } from "@/lib/store/clinic-store";
import { useSession } from "@/lib/auth/use-session";
import { getPatientFullNameTh } from "@/lib/mock-data/patients";
import { formatCurrency, formatCurrencySigned, formatDateTime } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

export default function TransactionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { can, user } = useSession();
  const transactions = useClinicStore((s) => s.transactions);
  const patients = useClinicStore((s) => s.patients);
  const branches = useClinicStore((s) => s.branches);
  const staff = useClinicStore((s) => s.staff);
  const paymentMethods = useClinicStore((s) => s.paymentMethods);
  const voidTransaction = useClinicStore((s) => s.voidTransaction);

  const [voidStep, setVoidStep] = useState<"closed" | "reason" | "review">("closed");
  const [reason, setReason] = useState("");

  const txn = transactions.find((t) => t.id === id);
  if (!txn) notFound();

  const patient = patients.find((p) => p.id === txn.patientId);
  const branch = branches.find((b) => b.id === txn.branchId);
  const pm = paymentMethods.find((p) => p.id === txn.paymentMethodId);
  const treatingStaff = staff.find((s) => s.id === txn.treatingStaffId);
  const salesperson = staff.find((s) => s.id === txn.salespersonId);
  const commissionTotal = txn.commission.reduce((sum, c) => sum + c.amount, 0);
  const baseItems = txn.items.filter((i) => i.kind !== "DISCOUNT" && i.kind !== "SURCHARGE");
  const adjustmentItems = txn.items.filter((i) => i.kind === "DISCOUNT" || i.kind === "SURCHARGE");
  const canVoid = can("transaction.void") && txn.status === "COMPLETED";

  function doVoid() {
    if (!user) return;
    voidTransaction(txn!.id, reason.trim(), user.displayName);
    setVoidStep("closed");
    setReason("");
    toast.success("Transaction voided. Revenue, course balance and commission reversed.");
  }

  return (
    <>
      <Link href="/transactions" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Transactions
      </Link>

      <PageHeader
        title={txn.transactionNo}
        description={`${formatDateTime(txn.date)} · ${branch?.name ?? ""}`}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={txn.status} className="text-sm" />
            {canVoid && (
              <Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => setVoidStep("reason")}>
                <Ban className="h-4 w-4" /> Void Transaction
              </Button>
            )}
          </div>
        }
      />

      {txn.status === "VOID" && txn.voidInfo && (
        <div className="mb-5 rounded-xl border border-destructive/25 bg-destructive/5 p-4">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-destructive">
            <TriangleAlert className="h-4 w-4" /> This transaction has been voided
          </p>
          <dl className="mt-2 grid grid-cols-1 gap-1 text-sm text-muted-foreground sm:grid-cols-3">
            <div><dt className="inline">Voided by: </dt><dd className="inline font-medium text-foreground">{txn.voidInfo.voidBy}</dd></div>
            <div><dt className="inline">Voided at: </dt><dd className="inline font-medium text-foreground">{formatDateTime(txn.voidInfo.voidAt)}</dd></div>
            <div className="sm:col-span-3"><dt className="inline">Reason: </dt><dd className="inline font-medium text-foreground">{txn.voidInfo.reason}</dd></div>
          </dl>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Section title="Items">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-center">Qty</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {baseItems.map((item, i) => (
                  <TableRow key={i}>
                    <TableCell>{item.description}</TableCell>
                    <TableCell className="text-center">{item.qty}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.amount)}</TableCell>
                  </TableRow>
                ))}
                {adjustmentItems.map((item, i) => (
                  <TableRow key={`adj-${i}`}>
                    <TableCell>
                      <span className="flex items-center gap-2">
                        <span
                          className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${
                            item.kind === "DISCOUNT" ? "bg-success/10 text-success" : "bg-warning/15 text-[#8A5A00]"
                          }`}
                        >
                          {item.kind === "DISCOUNT" ? "Discount" : "Charge"}
                        </span>
                        {item.description}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">{item.qty}</TableCell>
                    <TableCell
                      className={`text-right ${item.kind === "DISCOUNT" ? "text-success" : "text-[#8A5A00]"}`}
                    >
                      {formatCurrencySigned(item.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Separator className="my-3" />
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatCurrency(txn.subtotal)}</span></div>
              {adjustmentItems.map((item, i) => (
                <div key={i} className="flex justify-between">
                  <span className="text-muted-foreground">{item.description}</span>
                  <span className={item.kind === "DISCOUNT" ? "text-success" : "text-[#8A5A00]"}>
                    {formatCurrencySigned(item.amount)}
                  </span>
                </div>
              ))}
              <div className="flex justify-between text-base font-semibold"><span>Total</span><span>{formatCurrency(txn.total)}</span></div>
            </div>
          </Section>

          {txn.courseImpact.length > 0 && (
            <Section title="Course Impact" icon={Ticket}>
              <ul className="space-y-1.5 text-sm">
                {txn.courseImpact.map((c, i) => (
                  <li key={i} className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2">
                    <span className="text-muted-foreground">{c.label}</span>
                    <span className={`font-semibold ${c.quantity > 0 ? "text-success" : "text-warning"}`}>
                      {c.quantity > 0 ? "+" : ""}{c.quantity} session{Math.abs(c.quantity) !== 1 && "s"}
                    </span>
                  </li>
                ))}
              </ul>
              {txn.patientCourseId && (
                <Button asChild variant="outline" size="sm" className="mt-3">
                  <Link href={`/courses/${txn.patientCourseId}`}>View Course Ledger</Link>
                </Button>
              )}
            </Section>
          )}

          {txn.commission.length > 0 && (
            <Section title="Commission" icon={Percent}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rule</TableHead>
                    <TableHead>Staff</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {txn.commission.map((c, i) => {
                    const s = staff.find((st) => st.id === c.staffId);
                    return (
                      <TableRow key={i}>
                        <TableCell>{c.ruleName}</TableCell>
                        <TableCell>{s?.name ?? "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{c.type === "TREATMENT" ? "Treating" : "Sales"}</TableCell>
                        <TableCell className={`text-right font-medium ${txn.status === "VOID" ? "text-muted-foreground line-through" : ""}`}>
                          {formatCurrency(c.amount)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Section>
          )}

          <Section title="Audit Timeline">
            <ol className="space-y-3">
              <TimelineItem label="Transaction created" detail={formatDateTime(txn.date)} done />
              <TimelineItem label={`Payment received via ${pm?.name ?? "—"}`} detail={formatCurrency(txn.total)} done />
              {txn.courseImpact.length > 0 && <TimelineItem label="Course balance updated" detail={`${txn.courseImpact.length} ledger ${txn.courseImpact.length === 1 ? "entry" : "entries"} created`} done />}
              {txn.commission.length > 0 && <TimelineItem label="Commission generated" detail={formatCurrency(commissionTotal)} done />}
              {txn.voidInfo && (
                <TimelineItem
                  label="Transaction voided"
                  detail={`${formatDateTime(txn.voidInfo.voidAt)} by ${txn.voidInfo.voidBy} — ${txn.voidInfo.reason}`}
                  danger
                />
              )}
            </ol>
          </Section>
        </div>

        <div className="space-y-4">
          <Section title="Patient">
            <dl className="space-y-2 text-sm">
              <Row label="Patient" value={patient ? getPatientFullNameTh(patient) : "—"} />
              <Row label="HN" value={patient?.hn ?? "—"} mono />
            </dl>
            {patient && (
              <Button asChild variant="outline" size="sm" className="mt-3 w-full">
                <Link href={`/patients/${patient.id}`}>View Patient Profile</Link>
              </Button>
            )}
          </Section>

          <Section title="Transaction">
            <dl className="space-y-2 text-sm">
              <Row label="Transaction No." value={txn.transactionNo} mono />
              <Row label="Date" value={formatDateTime(txn.date)} />
              <Row label="Branch" value={branch?.name ?? "—"} />
              <Row label="Type" value={txn.type.replace("_", " ")} />
            </dl>
          </Section>

          <Section title="Staff">
            <dl className="space-y-2 text-sm">
              <Row label="Treating Staff" value={treatingStaff?.name ?? "—"} />
              <Row label="Salesperson" value={salesperson?.name ?? "—"} />
            </dl>
          </Section>

          <Section title="Payment">
            <dl className="space-y-2 text-sm">
              <Row label="Method" value={pm?.name ?? "—"} />
              <Row label="Amount" value={formatCurrency(txn.total)} />
            </dl>
          </Section>
        </div>
      </div>

      <Dialog open={voidStep !== "closed"} onOpenChange={(o) => !o && setVoidStep("closed")}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{voidStep === "reason" ? "Void Transaction" : "Review Void Impact"}</DialogTitle>
          </DialogHeader>
          {voidStep === "reason" ? (
            <div className="space-y-1.5">
              <Label>Reason for voiding <span className="text-destructive">*</span></Label>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="e.g. Duplicate entry, wrong service selected" />
              <p className="text-xs text-muted-foreground">Transactions are never deleted — voiding creates reversal entries.</p>
            </div>
          ) : (
            <div className="space-y-2 text-sm">
              <p className="text-muted-foreground">Confirming will apply these reversals:</p>
              <div className="flex justify-between rounded-lg bg-muted/50 px-3 py-2">
                <span>Revenue</span>
                <span className="font-semibold text-destructive">-{formatCurrency(txn.total)}</span>
              </div>
              {txn.courseImpact.map((c, i) => (
                <div key={i} className="flex justify-between rounded-lg bg-muted/50 px-3 py-2">
                  <span>{c.label}</span>
                  <span className="font-semibold text-warning">{c.quantity > 0 ? "" : "+"}{-c.quantity} session{Math.abs(c.quantity) !== 1 && "s"}</span>
                </div>
              ))}
              {txn.commission.length > 0 && (
                <div className="flex justify-between rounded-lg bg-muted/50 px-3 py-2">
                  <span>Commission</span>
                  <span className="font-semibold text-destructive">Reversed ({formatCurrency(commissionTotal)})</span>
                </div>
              )}
              <p className="rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">Reason: {reason}</p>
            </div>
          )}
          <DialogFooter>
            {voidStep === "reason" ? (
              <>
                <Button variant="outline" onClick={() => setVoidStep("closed")}>Cancel</Button>
                <Button disabled={!reason.trim()} onClick={() => setVoidStep("review")}>Review Impact</Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setVoidStep("reason")}>Back</Button>
                <Button variant="destructive" onClick={doVoid}>Confirm Void</Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon?: typeof Ticket; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
        {Icon && <Icon className="h-4 w-4" />} {title}
      </h3>
      {children}
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={`text-right font-medium text-foreground ${mono ? "font-mono text-xs" : ""}`}>{value}</dd>
    </div>
  );
}

function TimelineItem({ label, detail, done, danger }: { label: string; detail: string; done?: boolean; danger?: boolean }) {
  return (
    <li className="flex gap-3">
      <div className="flex flex-col items-center">
        {danger ? (
          <Ban className="h-4 w-4 text-destructive" />
        ) : done ? (
          <CheckCircle2 className="h-4 w-4 text-success" />
        ) : (
          <CircleDot className="h-4 w-4 text-muted-foreground" />
        )}
      </div>
      <div className="pb-1">
        <p className={`text-sm font-medium ${danger ? "text-destructive" : "text-foreground"}`}>{label}</p>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </div>
    </li>
  );
}
