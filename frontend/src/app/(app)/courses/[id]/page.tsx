"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRightLeft, HandCoins, Search, UsersRound } from "lucide-react";
import { useClinicStore } from "@/lib/store/clinic-store";
import { useSession } from "@/lib/auth/use-session";
import { getPatientFullNameTh, searchPatients } from "@/lib/domain";
import { formatDate, formatDateTime } from "@/lib/format";
import { remainingSessions } from "@/lib/domain";
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
import { addSharedCourseMember, getCourseCommissionDetail, listSharedCourseMembers, refundRemainingVisits, removeSharedCourseMember } from "@/lib/api/clinic-api";
import type { LedgerEntryType, SharedCourseMember } from "@/types";

const ledgerTypeLabel: Record<LedgerEntryType, string> = {
  PURCHASE: "Purchase",
  BONUS: "Bonus",
  TREATMENT: "Treatment",
  TRANSFER_OUT: "Transfer Out",
  TRANSFER_IN: "Transfer In",
  VOID_REVERSAL: "Void Reversal",
  REFUND_REMAINING: "Refund Remaining",
};

type TransferStep = "closed" | "search" | "sessions" | "review";
type CourseCommissionDetail = {
  course?: Record<string, unknown>;
  allocations?: unknown[];
  usages?: unknown[];
  adjustments?: unknown[];
};

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
  const [commissionDetail, setCommissionDetail] = useState<CourseCommissionDetail | null>(null);
  const [members, setMembers] = useState<SharedCourseMember[]>([]);
  const [memberOpen, setMemberOpen] = useState(false);
  const [memberQuery, setMemberQuery] = useState("");
  const [memberPatientId, setMemberPatientId] = useState("");
  const [memberVisits, setMemberVisits] = useState(1);
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundVisits, setRefundVisits] = useState(1);
  const [refundReason, setRefundReason] = useState("");

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
  const memberMatches = memberQuery ? searchPatients(memberQuery, patients).filter((p) => p.id !== pc.patientId).slice(0, 6) : [];
  const memberPatient = patients.find((p) => p.id === memberPatientId);

  useEffect(() => {
    void getCourseCommissionDetail(id).then((value) => setCommissionDetail(value as CourseCommissionDetail)).catch(() => setCommissionDetail(null));
    void listSharedCourseMembers(id).then(setMembers).catch(() => setMembers([]));
  }, [id]);

  function openTransfer() {
    setStep("search"); setQuery(""); setToPatientId(""); setSessions(1); setError(null);
  }

  async function confirmTransfer() {
    if (!user) return;
    const result = await transferCourseSessions(pc!.id, toPatientId, sessions);
    if (!result.ok) { setError(result.error ?? "Transfer failed"); return; }
    setStep("closed");
    toast.success(`Transferred ${sessions} session(s) to ${toPatient ? getPatientFullNameTh(toPatient) : "patient"}`);
  }

  async function confirmMember() {
    if (!memberPatientId) return;
    try {
      await addSharedCourseMember(id, memberPatientId, memberVisits);
      setMembers(await listSharedCourseMembers(id));
      setMemberOpen(false);
      toast.success("Shared course member added");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add shared member");
    }
  }

  async function removeMember(patientId: string) {
    try {
      await removeSharedCourseMember(id, patientId);
      setMembers(await listSharedCourseMembers(id));
      toast.success("Shared course member removed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove shared member");
    }
  }

  async function confirmRefund() {
    if (!refundReason.trim()) { toast.error("Reason is required"); return; }
    try {
      await refundRemainingVisits(id, refundVisits, refundReason.trim());
      setRefundOpen(false);
      toast.success("Unused sessions refunded and history preserved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not refund remaining sessions");
    }
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
            {pc.status === "ACTIVE" && rem > 0 && can("course.transfer") && <Button variant="outline" onClick={() => { setMemberOpen(true); setMemberQuery(""); setMemberPatientId(""); setMemberVisits(1); }}><UsersRound className="h-4 w-4" /> Share</Button>}
            {can("transaction.void") && rem > 0 && <Button variant="outline" onClick={() => { setRefundOpen(true); setRefundVisits(1); setRefundReason(""); }}><HandCoins className="h-4 w-4" /> Refund Unused</Button>}
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

      <div className="mb-5 rounded-xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between"><div><h3 className="text-sm font-semibold text-foreground">Commission Pool</h3><p className="text-xs text-muted-foreground">Locked rate and released commission for this course</p></div><span className="text-xs text-muted-foreground">{commissionDetail?.allocations?.length ?? 0} allocations</span></div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <InfoRow label="Status" value={String(commissionDetail?.course?.commission_status ?? "PROVISIONAL")} />
          <InfoRow label="Locked Rate" value={commissionDetail?.course?.locked_commission_rate == null ? "Pending close" : `${Number(commissionDetail.course.locked_commission_rate) * 100}%`} />
          <InfoRow label="Pool" value={commissionDetail?.course?.total_course_commission_pool == null ? "—" : `฿${commissionDetail.course.total_course_commission_pool}`} />
          <InfoRow label="Outstanding" value={commissionDetail?.course?.total_course_commission_pool == null ? "—" : `฿${Number(commissionDetail.course.total_course_commission_pool) - Number(commissionDetail.course.gross_commission_allocated_total ?? 0)}`} />
        </div>
      </div>

      <div className="mb-5 rounded-xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between"><div><h3 className="text-sm font-semibold text-foreground">Shared Course Members</h3><p className="text-xs text-muted-foreground">Members share one course balance and one commission pool</p></div>{can("course.transfer") && <Button size="sm" variant="outline" onClick={() => { setMemberOpen(true); setMemberQuery(""); setMemberPatientId(""); setMemberVisits(1); }}><UsersRound className="h-4 w-4" /> Add Member</Button>}</div>
        {members.length === 0 ? <p className="text-sm text-muted-foreground">No shared members</p> : <div className="space-y-2">{members.map((m) => { const p = patients.find((x) => x.id === m.patientId); return <div key={m.patientId} className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-sm"><span>{p ? getPatientFullNameTh(p) : `Patient #${m.patientId}`} <span className="ml-2 text-xs text-muted-foreground">{m.allocatedVisits - m.usedVisits} remaining</span></span>{m.role === "SHARED_MEMBER" && can("course.transfer") && <Button variant="ghost" size="sm" onClick={() => void removeMember(m.patientId)}>Remove</Button>}</div>; })}</div>}
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

      <Dialog open={memberOpen} onOpenChange={setMemberOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Shared Course Member</DialogTitle></DialogHeader>
          <div className="space-y-3"><p className="text-sm text-muted-foreground">Sessions moved to this member keep the same Course ID and commission pool.</p><div className="space-y-1.5"><Label>Search patient</Label><Input value={memberQuery} onChange={(e) => setMemberQuery(e.target.value)} placeholder="HN, name or phone..." />{memberMatches.length > 0 && <div className="rounded-lg border border-border">{memberMatches.map((p) => <button key={p.id} className={`block w-full px-3 py-2 text-left text-sm hover:bg-muted ${memberPatientId === p.id ? "bg-primary/5" : ""}`} onClick={() => setMemberPatientId(p.id)}>{getPatientFullNameTh(p)} <span className="text-xs text-muted-foreground">{p.hn}</span></button>)}</div>}</div><div className="space-y-1.5"><Label>Sessions to allocate</Label><Input type="number" min={1} max={rem} value={memberVisits} onChange={(e) => setMemberVisits(Math.max(1, Math.min(rem, Number(e.target.value) || 1)))} /></div>{memberPatient && <p className="text-sm text-muted-foreground">Selected: {getPatientFullNameTh(memberPatient)}</p>}</div>
          <DialogFooter><Button variant="outline" onClick={() => setMemberOpen(false)}>Cancel</Button><Button disabled={!memberPatientId} onClick={() => void confirmMember()}>Add Member</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={refundOpen} onOpenChange={setRefundOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Refund Unused Sessions</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Used visits and commission history stay unchanged. Only the unused remainder is reduced.</p>
          <div className="space-y-3"><div className="space-y-1.5"><Label>Sessions to refund (max {rem})</Label><Input type="number" min={1} max={rem} value={refundVisits} onChange={(e) => setRefundVisits(Math.max(1, Math.min(rem, Number(e.target.value) || 1)))} /></div><div className="space-y-1.5"><Label>Reason</Label><Input value={refundReason} onChange={(e) => setRefundReason(e.target.value)} placeholder="Patient requested refund" /></div></div>
          <DialogFooter><Button variant="outline" onClick={() => setRefundOpen(false)}>Cancel</Button><Button onClick={() => void confirmRefund()}>Confirm Refund</Button></DialogFooter>
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
