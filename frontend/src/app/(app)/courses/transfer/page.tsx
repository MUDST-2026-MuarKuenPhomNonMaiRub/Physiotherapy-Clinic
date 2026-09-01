"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeftRight, ArrowRight, Search, Ticket } from "lucide-react";
import { useClinicStore } from "@/lib/store/clinic-store";
import { useSession } from "@/lib/auth/use-session";
import { useBranchScope } from "@/lib/auth/use-branch-scope";
import { getPatientFullNameTh, searchPatients } from "@/lib/mock-data/patients";
import { remainingSessions } from "@/lib/mock-data/course-data";
import { formatDate, formatDateTime } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { BranchFilterSelect } from "@/components/shared/branch-filter-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

type Step = "closed" | "source" | "target" | "review";

export default function CoursesTransferPage() {
  const { user, can } = useSession();
  const { isAccessible } = useBranchScope();
  const patients = useClinicStore((s) => s.patients);
  const branches = useClinicStore((s) => s.branches);
  const courseLedger = useClinicStore((s) => s.courseLedger);
  const patientCourses = useClinicStore((s) => s.patientCourses);
  const courseTemplates = useClinicStore((s) => s.courseTemplates);
  const transferCourseSessions = useClinicStore((s) => s.transferCourseSessions);

  const [branchFilter, setBranchFilter] = useState("ALL");
  const [step, setStep] = useState<Step>("closed");
  const [sourceQuery, setSourceQuery] = useState("");
  const [sourceCourseId, setSourceCourseId] = useState("");
  const [targetQuery, setTargetQuery] = useState("");
  const [targetPatientId, setTargetPatientId] = useState("");
  const [sessions, setSessions] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const history = useMemo(() => {
    const outs = courseLedger
      .filter((l) => l.type === "TRANSFER_OUT" && l.transferGroupId)
      .filter((l) => (branchFilter === "ALL" ? isAccessible(l.branchId) : l.branchId === branchFilter));
    return outs
      .map((out) => {
        const in_ = courseLedger.find((l) => l.type === "TRANSFER_IN" && l.transferGroupId === out.transferGroupId);
        const fromPc = patientCourses.find((p) => p.id === out.patientCourseId);
        const toPc = in_ ? patientCourses.find((p) => p.id === in_.patientCourseId) : undefined;
        const template = fromPc ? courseTemplates.find((c) => c.id === fromPc.courseId) : undefined;
        return {
          id: out.id,
          date: out.date,
          fromPatient: fromPc ? patients.find((p) => p.id === fromPc.patientId) : undefined,
          toPatient: toPc ? patients.find((p) => p.id === toPc.patientId) : undefined,
          course: template?.name ?? "—",
          sessions: Math.abs(out.quantity),
          branch: branches.find((b) => b.id === out.branchId)?.name,
          performedBy: out.performedBy,
        };
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [courseLedger, patientCourses, courseTemplates, patients, branches, branchFilter, isAccessible]);

  const totalSessions = history.reduce((s, r) => s + r.sessions, 0);

  // --- transfer wizard -----------------------------------------------------
  const sourceMatches = sourceQuery ? searchPatients(sourceQuery, patients).slice(0, 6) : [];
  const sourceCourse = patientCourses.find((p) => p.id === sourceCourseId);
  const sourcePatient = sourceCourse ? patients.find((p) => p.id === sourceCourse.patientId) : undefined;
  const sourceRemaining = sourceCourse ? remainingSessions(sourceCourse) : 0;
  const targetMatches = targetQuery
    ? searchPatients(targetQuery, patients)
        .filter((p) => p.id !== sourceCourse?.patientId)
        .slice(0, 6)
    : [];
  const targetPatient = patients.find((p) => p.id === targetPatientId);

  function transferableCoursesFor(patientId: string) {
    return patientCourses.filter(
      (pc) => pc.patientId === patientId && pc.status === "ACTIVE" && remainingSessions(pc) > 0
    );
  }

  function openWizard() {
    setStep("source");
    setSourceQuery("");
    setSourceCourseId("");
    setTargetQuery("");
    setTargetPatientId("");
    setSessions(1);
    setError(null);
  }

  function confirm() {
    if (!user || !sourceCourse) return;
    const result = transferCourseSessions(sourceCourse.id, targetPatientId, sessions, user.displayName);
    if (!result.ok) {
      setError(result.error ?? "Transfer failed");
      return;
    }
    setStep("closed");
    toast.success(
      `Transferred ${sessions} session${sessions > 1 ? "s" : ""} to ${targetPatient ? getPatientFullNameTh(targetPatient) : "patient"}`
    );
  }

  return (
    <>
      <PageHeader
        title="Courses Transfer"
        description="Move remaining sessions from one patient's course to another, and review every transfer made"
        actions={
          can("course.transfer") ? (
            <Button onClick={openWizard}>
              <ArrowLeftRight className="h-4 w-4" /> New Transfer
            </Button>
          ) : undefined
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <BranchFilterSelect value={branchFilter} onValueChange={setBranchFilter} className="w-44" />
        <p className="ml-auto text-sm text-muted-foreground">
          {history.length} {history.length === 1 ? "transfer" : "transfers"}
        </p>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <StatCard label="Transfer Events" value={String(history.length)} icon={ArrowLeftRight} tone="primary" />
        <StatCard label="Sessions Transferred" value={String(totalSessions)} icon={Ticket} tone="success" />
      </div>

      {history.length === 0 ? (
        <EmptyState
          icon={ArrowLeftRight}
          title="No course transfers yet"
          description="Sessions moved between patients will be listed here with a full audit trail."
          action={can("course.transfer") ? <Button onClick={openWizard}>New Transfer</Button> : undefined}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>From Patient</TableHead>
                  <TableHead>To Patient</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead className="text-center">Sessions</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Performed By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((r) => (
                  <TableRow key={r.id} className="[&>td]:py-3">
                    <TableCell className="text-muted-foreground">{formatDateTime(r.date)}</TableCell>
                    <TableCell>{r.fromPatient ? getPatientFullNameTh(r.fromPatient) : "—"}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5">
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                        {r.toPatient ? getPatientFullNameTh(r.toPatient) : "—"}
                      </span>
                    </TableCell>
                    <TableCell>{r.course}</TableCell>
                    <TableCell className="text-center font-medium">{r.sessions}</TableCell>
                    <TableCell className="text-muted-foreground">{r.branch}</TableCell>
                    <TableCell className="text-muted-foreground">{r.performedBy}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <Dialog open={step !== "closed"} onOpenChange={(o) => !o && setStep("closed")}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {step === "source" && "Transfer from"}
              {step === "target" && "Transfer to"}
              {step === "review" && "Review transfer"}
            </DialogTitle>
            <DialogDescription>
              {step === "source" && "Find the patient who owns the course."}
              {step === "target" && "Find the patient receiving the sessions."}
              {step === "review" && "Sessions move immediately and are recorded in both course ledgers."}
            </DialogDescription>
          </DialogHeader>

          {step === "source" && (
            <div className="space-y-3">
              <SearchField value={sourceQuery} onChange={setSourceQuery} placeholder="Search HN, name or phone…" />
              <div className="space-y-2">
                {sourceMatches.map((p) => {
                  const courses = transferableCoursesFor(p.id);
                  return (
                    <div key={p.id} className="rounded-xl border border-border p-3">
                      <p className="text-sm font-medium text-foreground">{getPatientFullNameTh(p)}</p>
                      <p className="text-xs text-muted-foreground">{p.hn}</p>
                      {courses.length === 0 ? (
                        <p className="mt-2 text-xs text-muted-foreground">No transferable course</p>
                      ) : (
                        <div className="mt-2 space-y-1.5">
                          {courses.map((pc) => {
                            const template = courseTemplates.find((c) => c.id === pc.courseId);
                            return (
                              <button
                                key={pc.id}
                                type="button"
                                onClick={() => {
                                  setSourceCourseId(pc.id);
                                  setSessions(1);
                                  setStep("target");
                                }}
                                className="flex w-full cursor-pointer items-center justify-between rounded-lg border border-border bg-muted/40 px-3 py-2 text-left text-sm transition-colors hover:border-primary/40 hover:bg-accent"
                              >
                                <span>
                                  <span className="font-medium text-foreground">{template?.name}</span>
                                  <span className="ml-2 text-xs text-muted-foreground">exp. {formatDate(pc.expiryDate)}</span>
                                </span>
                                <span className="shrink-0 text-xs font-semibold text-primary">
                                  {remainingSessions(pc)} left
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
                {sourceQuery && sourceMatches.length === 0 && (
                  <p className="py-4 text-center text-sm text-muted-foreground">No patient found</p>
                )}
              </div>
            </div>
          )}

          {step === "target" && sourceCourse && (
            <div className="space-y-3">
              <div className="rounded-xl border border-border bg-muted/40 p-3 text-sm">
                <p className="text-xs text-muted-foreground">Transferring from</p>
                <p className="font-medium text-foreground">
                  {sourcePatient ? getPatientFullNameTh(sourcePatient) : "—"} ·{" "}
                  {courseTemplates.find((c) => c.id === sourceCourse.courseId)?.name}
                </p>
                <p className="text-xs text-muted-foreground">{sourceRemaining} sessions remaining</p>
              </div>
              <SearchField value={targetQuery} onChange={setTargetQuery} placeholder="Search recipient…" />
              <div className="space-y-1.5">
                {targetMatches.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => { setTargetPatientId(p.id); setStep("review"); }}
                    className="flex w-full cursor-pointer items-center justify-between rounded-lg border border-border px-3 py-2 text-left text-sm transition-colors hover:border-primary/40 hover:bg-accent"
                  >
                    <span className="font-medium text-foreground">{getPatientFullNameTh(p)}</span>
                    <span className="text-xs text-muted-foreground">{p.hn}</span>
                  </button>
                ))}
                {targetQuery && targetMatches.length === 0 && (
                  <p className="py-4 text-center text-sm text-muted-foreground">No patient found</p>
                )}
              </div>
            </div>
          )}

          {step === "review" && sourceCourse && (
            <div className="space-y-4">
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                <TransferParty
                  label="From"
                  name={sourcePatient ? getPatientFullNameTh(sourcePatient) : "—"}
                  detail={`${sourceRemaining} sessions left`}
                />
                <ArrowRight className="h-5 w-5 text-muted-foreground" />
                <TransferParty
                  label="To"
                  name={targetPatient ? getPatientFullNameTh(targetPatient) : "—"}
                  detail={targetPatient?.hn ?? ""}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sessions">Sessions to transfer</Label>
                <Input
                  id="sessions"
                  type="number"
                  min={1}
                  max={sourceRemaining}
                  value={sessions}
                  onChange={(e) => setSessions(Math.max(1, Math.min(sourceRemaining, Number(e.target.value) || 1)))}
                  className="w-28"
                />
                <p className="text-xs text-muted-foreground">Maximum {sourceRemaining}.</p>
              </div>
              {error && (
                <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            {step === "target" && <Button variant="outline" onClick={() => setStep("source")}>Back</Button>}
            {step === "review" && <Button variant="outline" onClick={() => setStep("target")}>Back</Button>}
            <Button variant="ghost" onClick={() => setStep("closed")}>Cancel</Button>
            {step === "review" && (
              <Button onClick={confirm} disabled={sessions < 1 || sessions > sourceRemaining}>
                Confirm Transfer
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <p className="mt-4 text-xs text-muted-foreground">
        Looking for one patient&apos;s balance? Open it from{" "}
        <Link href="/courses" className="font-medium text-primary underline-offset-4 hover:underline">
          Patient Courses
        </Link>
        .
      </p>
    </>
  );
}

function SearchField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-9 pl-8" />
    </div>
  );
}

function TransferParty({ label, name, detail }: { label: string; name: string; detail: string }) {
  return (
    <div className="rounded-xl border border-border bg-muted/40 p-3">
      <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-sm font-medium text-foreground">{name}</p>
      <p className="truncate text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}
