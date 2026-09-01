"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRightLeft, Search } from "lucide-react";
import { useClinicStore } from "@/lib/store/clinic-store";
import { useSession } from "@/lib/auth/use-session";
import { getPatientFullNameTh, searchPatients } from "@/lib/mock-data/patients";
import { formatDate, formatDateTime } from "@/lib/format";
import { remainingSessions } from "@/lib/mock-data/course-data";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import type { LedgerEntryType } from "@/types";

const ledgerTypeLabel: Record<LedgerEntryType, string> = {
  PURCHASE: "Purchase",
  BONUS: "Bonus",
  TREATMENT: "Treatment",
  TRANSFER_OUT: "Transfer Out",
  TRANSFER_IN: "Transfer In",
  VOID_REVERSAL: "Void Reversal",
};

type TransferStep = "closed" | "search" | "sessions" | "review";

export default function CourseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { can, user } = useSession();
  const patients = useClinicStore((s) => s.patients);
  const branches = useClinicStore((s) => s.branches);
  const patientCourses = useClinicStore((s) => s.patientCourses);
  const courseLedger = useClinicStore((s) => s.courseLedger);
  const courseTemplates = useClinicStore((s) => s.courseTemplates);
  const transferCourseSessions = useClinicStore((s) => s.transferCourseSessions);

  const [step, setStep] = useState<TransferStep>("closed");
  const [query, setQuery] = useState("");
  const [toPatientId, setToPatientId] = useState("");
  const [sessions, setSessions] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const found = patientCourses.find((p) => p.id === id);
  if (!found) notFound();
  const pc = found;

  const patient = patients.find((p) => p.id === pc.patientId);
  const template = courseTemplates.find((c) => c.id === pc.courseId);
  const branch = branches.find((b) => b.id === pc.branchId);
  const ledger = useMemo(
    () => courseLedger.filter((l) => l.patientCourseId === id).sort((a, b) => a.date.localeCompare(b.date)),
    [courseLedger, id]
  );
  const rem = remainingSessions(pc);
  const total = pc.purchased + pc.bonus + pc.transferIn;

  const matches = query ? searchPatients(query, patients).filter((p) => p.id !== pc.patientId).slice(0, 6) : [];
  const toPatient = patients.find((p) => p.id === toPatientId);

  function openTransfer() {
    setStep("search"); setQuery(""); setToPatientId(""); setSessions(1); setError(null);
  }

  function confirmTransfer() {
    if (!user) return;
    const result = transferCourseSessions(pc!.id, toPatientId, sessions, user.displayName);
    if (!result.ok) { setError(result.error ?? "Transfer failed"); return; }
    setStep("closed");
    toast.success(`Transferred ${sessions} session(s) to ${toPatient ? getPatientFullNameTh(toPatient) : "patient"}`);
  }

  return (
    <>
      <Link href="/courses" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Patient Courses
      </Link>

      <PageHeader
        title={template?.name ?? "Course"}
        description={patient ? `${getPatientFullNameTh(patient)} · ${patient.hn}` : ""}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={pc.status} className="text-sm" />
            {can("course.transfer") && pc.status === "ACTIVE" && rem > 0 && (
              <Button variant="outline" onClick={openTransfer}>
                <ArrowRightLeft className="h-4 w-4" /> Transfer Course
              </Button>
            )}
          </div>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <SummaryCard label="Purchased" value={pc.purchased} />
        <SummaryCard label="Bonus" value={pc.bonus} />
        <SummaryCard label="Transfer In" value={pc.transferIn} />
        <SummaryCard label="Transfer Out" value={pc.transferOut} />
        <SummaryCard label="Used" value={pc.used} />
        <SummaryCard label="Remaining" value={rem} highlight />
      </div>

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <InfoRow label="Owner" value={patient ? getPatientFullNameTh(patient) : "—"} />
        <InfoRow label="Purchase Date" value={formatDate(pc.purchaseDate)} />
        <InfoRow label="Expiry" value={formatDate(pc.expiryDate)} />
        <InfoRow label="Branch" value={branch?.name ?? "—"} />
      </div>

      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Course Ledger</h3>
        <p className="text-xs text-muted-foreground">{total} total sessions ({pc.purchased} purchased + {pc.bonus} bonus{pc.transferIn > 0 && ` + ${pc.transferIn} transfer in`})</p>
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date / Time</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-center">Quantity</TableHead>
                <TableHead className="text-center">Balance</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Related Transaction</TableHead>
                <TableHead>Performed By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ledger.map((l) => {
                const br = branches.find((b) => b.id === l.branchId);
                return (
                  <TableRow key={l.id}>
                    <TableCell className="text-muted-foreground">{formatDateTime(l.date)}</TableCell>
                    <TableCell>{ledgerTypeLabel[l.type]}</TableCell>
                    <TableCell className={`text-center font-medium ${l.quantity > 0 ? "text-success" : "text-warning"}`}>
                      {l.quantity > 0 ? "+" : ""}{l.quantity}
                    </TableCell>
                    <TableCell className="text-center font-semibold text-foreground">{l.balanceAfter}</TableCell>
                    <TableCell className="text-muted-foreground">{br?.code}</TableCell>
                    <TableCell>
                      {l.relatedTransactionId ? (
                        <Link href={`/transactions/${l.relatedTransactionId}`} className="text-xs text-primary hover:underline">
                          View
                        </Link>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{l.performedBy}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={step !== "closed"} onOpenChange={(o) => !o && setStep("closed")}>
        <DialogContent>
          <DialogHeader><DialogTitle>Transfer Course Sessions</DialogTitle></DialogHeader>

          {step === "search" && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                From <span className="font-medium text-foreground">{patient ? getPatientFullNameTh(patient) : ""}</span> — {rem} sessions available
              </p>
              <div className="space-y-1.5">
                <Label>Search Receiving Patient</Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="HN, name or phone..." className="pl-9" />
                </div>
                {matches.length > 0 && (
                  <div className="overflow-hidden rounded-lg border border-border">
                    {matches.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setToPatientId(p.id)}
                        className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted ${toPatientId === p.id ? "bg-primary/5" : ""}`}
                      >
                        <span className="font-medium">{getPatientFullNameTh(p)}</span>
                        <span className="font-mono text-xs text-muted-foreground">{p.hn}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {step === "sessions" && (
            <div className="space-y-1.5">
              <Label>Sessions to Transfer (max {rem})</Label>
              <Input
                type="number"
                min={1}
                max={rem}
                value={sessions}
                onChange={(e) => setSessions(Math.max(1, Math.min(rem, Number(e.target.value) || 1)))}
              />
            </div>
          )}

          {step === "review" && toPatient && (
            <div className="space-y-3 text-sm">
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">From</p>
                <p className="font-medium text-foreground">{patient ? getPatientFullNameTh(patient) : ""}</p>
                <p className="text-xs text-muted-foreground">Current Remaining: {rem}</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">To</p>
                <p className="font-medium text-foreground">{getPatientFullNameTh(toPatient)}</p>
              </div>
              <div className="rounded-lg bg-primary/5 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Transfer</p>
                <p className="font-semibold text-primary">{sessions} Sessions</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">After Transfer</p>
                <p className="text-foreground">{patient?.firstNameTh}: {rem - sessions}</p>
                <p className="text-foreground">{toPatient.firstNameTh}: +{sessions}</p>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
          )}

          <DialogFooter>
            {step === "search" && (
              <>
                <Button variant="outline" onClick={() => setStep("closed")}>Cancel</Button>
                <Button disabled={!toPatientId} onClick={() => setStep("sessions")}>Next</Button>
              </>
            )}
            {step === "sessions" && (
              <>
                <Button variant="outline" onClick={() => setStep("search")}>Back</Button>
                <Button onClick={() => setStep("review")}>Review Transfer</Button>
              </>
            )}
            {step === "review" && (
              <>
                <Button variant="outline" onClick={() => setStep("sessions")}>Back</Button>
                <Button onClick={confirmTransfer}>Confirm Transfer</Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SummaryCard({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${highlight ? "border-primary/30 bg-primary/5" : "border-border bg-card"}`}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${highlight ? "text-primary" : "text-foreground"}`}>{value}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/40 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}
