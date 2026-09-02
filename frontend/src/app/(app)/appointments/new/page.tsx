"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowLeft, Search, X } from "lucide-react";
import { useClinicStore } from "@/lib/store/clinic-store";
import { useSession } from "@/lib/auth/use-session";
import { getPatientFullNameTh, searchPatients } from "@/lib/mock-data/patients";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function NewAppointmentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, activeBranchId } = useSession();
  const patients = useClinicStore((s) => s.patients);
  const branches = useClinicStore((s) => s.branches);
  const staff = useClinicStore((s) => s.staff);
  const services = useClinicStore((s) => s.services);
  const resources = useClinicStore((s) => s.resources);
  const addAppointment = useClinicStore((s) => s.addAppointment);

  const preselectPatientId = searchParams.get("patientId");
  const [patientId, setPatientId] = useState(preselectPatientId ?? "");
  const [patientQuery, setPatientQuery] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [branchId, setBranchId] = useState(activeBranchId ?? branches[0]?.id ?? "");
  const [physioId, setPhysioId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [resourceId, setResourceId] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const accessibleBranches = branches.filter(
    (b) => b.status === "ACTIVE" && (user?.role === "ADMIN" || user?.branchIds.includes(b.id))
  );
  const service = services.find((s) => s.id === serviceId);
  const endTime = service ? addMinutes(startTime, service.duration) : startTime;
  const branchPhysios = staff.filter((s) => s.position === "Physiotherapist" && s.status === "ACTIVE" && s.branchIds.includes(branchId));
  const branchResources = resources.filter((r) => r.branchId === branchId && r.status === "ACTIVE");

  const patientMatches = useMemo(
    () => (patientQuery ? searchPatients(patientQuery, patients).slice(0, 6) : []),
    [patientQuery, patients]
  );
  const selectedPatient = patients.find((p) => p.id === patientId);

  function validate() {
    const e: Record<string, string> = {};
    if (!patientId) e.patientId = "Select a patient";
    if (!date) e.date = "Required";
    if (!branchId) e.branchId = "Required";
    if (!physioId) e.physioId = "Required";
    if (!serviceId) e.serviceId = "Required";
    if (!resourceId) e.resourceId = "Required";
    setFieldErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setError(null);
    if (!validate()) return;
    const result = addAppointment({
      patientId, date, startTime, endTime, branchId,
      physiotherapistId: physioId, serviceId, resourceId, note: note || undefined,
    });
    if (!result.ok) {
      setError(result.error ?? "Unable to create appointment");
      return;
    }
    router.push(`/appointments/${result.appointment!.id}`);
  }

  return (
    <>
      <PageHeader
        title="New Appointment"
        description="Schedule a new patient visit"
        actions={
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
        }
      />

      <form onSubmit={handleSubmit} className="max-w-2xl space-y-5 pb-10">
        <Card>
          <CardHeader><CardTitle className="text-base">Patient</CardTitle></CardHeader>
          <CardContent>
            {selectedPatient ? (
              <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium text-foreground">{getPatientFullNameTh(selectedPatient)}</p>
                  <p className="font-mono text-xs text-muted-foreground">{selectedPatient.hn} · {selectedPatient.phone}</p>
                </div>
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPatientId("")}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="relative">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={patientQuery}
                    onChange={(e) => setPatientQuery(e.target.value)}
                    placeholder="Search patient by HN, name or phone..."
                    className="pl-9"
                  />
                </div>
                {patientMatches.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-border bg-popover shadow-md">
                    {patientMatches.map((p) => (
                      <button
                        type="button"
                        key={p.id}
                        onClick={() => { setPatientId(p.id); setPatientQuery(""); }}
                        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted"
                      >
                        <span className="font-medium text-foreground">{getPatientFullNameTh(p)}</span>
                        <span className="font-mono text-xs text-muted-foreground">{p.hn}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {fieldErrors.patientId && <p className="mt-1.5 text-xs text-destructive">{fieldErrors.patientId}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Schedule</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                {fieldErrors.date && <p className="text-xs text-destructive">{fieldErrors.date}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Start Time</Label>
                <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>End Time</Label>
                <Input type="time" value={endTime} readOnly disabled className="bg-muted" />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Branch</Label>
                <Select value={branchId} onValueChange={(v) => { setBranchId(v); setPhysioId(""); setResourceId(""); }}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {accessibleBranches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Service</Label>
                <Select value={serviceId} onValueChange={setServiceId}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Select service" /></SelectTrigger>
                  <SelectContent>
                    {services.filter((s) => s.status === "ACTIVE").map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name} · {s.duration} min</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {fieldErrors.serviceId && <p className="text-xs text-destructive">{fieldErrors.serviceId}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Physiotherapist</Label>
                <Select value={physioId} onValueChange={setPhysioId}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Select physiotherapist" /></SelectTrigger>
                  <SelectContent>
                    {branchPhysios.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                {fieldErrors.physioId && <p className="text-xs text-destructive">{fieldErrors.physioId}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Room / Resource</Label>
                <Select value={resourceId} onValueChange={setResourceId}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Select room" /></SelectTrigger>
                  <SelectContent>
                    {branchResources.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                {fieldErrors.resourceId && <p className="text-xs text-destructive">{fieldErrors.resourceId}</p>}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Note</Label>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="e.g. Booked by phone, walk-in, follow-up visit" />
            </div>
          </CardContent>
        </Card>

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Scheduling Conflict</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit">Create Appointment</Button>
        </div>
      </form>
    </>
  );
}

export default function NewAppointmentPage() {
  return (
    <Suspense>
      <NewAppointmentContent />
    </Suspense>
  );
}
