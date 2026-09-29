"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowLeft, Minus, Plus, Search, X, Clock, CalendarDays } from "lucide-react";
import { useClinicStore } from "@/lib/store/clinic-store";
import { useSession } from "@/lib/auth/use-session";
import { getPatientFullNameTh, today } from "@/lib/domain";
import { usePatientSearch } from "@/lib/hooks/use-patient-search";
import { PageHeader } from "@/components/shared/page-header";
import { PageLoading } from "@/components/shared/page-loading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ServicePicker } from "@/components/shared/service-picker";
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
  const { user, activeBranchId, can } = useSession();
  const patients = useClinicStore((s) => s.patients);
  const branches = useClinicStore((s) => s.branches);
  const staff = useClinicStore((s) => s.staff);
  const services = useClinicStore((s) => s.services);
  const resources = useClinicStore((s) => s.resources);
  const addAppointment = useClinicStore((s) => s.addAppointment);

  const preselectPatientId = searchParams.get("patientId");
  const [patientId, setPatientId] = useState(preselectPatientId ?? "");
  const [patientQuery, setPatientQuery] = useState("");
  const [date, setDate] = useState(searchParams.get("date") ?? "");
  const [startTime, setStartTime] = useState(searchParams.get("time") ?? "09:00");
  const [endTime, setEndTime] = useState(addMinutes(searchParams.get("time") ?? "09:00", 30));
  const [branchId, setBranchId] = useState(searchParams.get("branchId") ?? activeBranchId ?? branches[0]?.id ?? "");
  const [physioId, setPhysioId] = useState(searchParams.get("physioId") ?? "");
  const [serviceId, setServiceId] = useState("");
  const [resourceId, setResourceId] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const accessibleBranches = branches.filter((b) => user?.branchIds.includes(b.id) && b.status === "ACTIVE");
  const service = services.find((s) => s.id === serviceId);
  const branchPhysios = staff.filter((s) => s.position === "Physiotherapist" && s.status === "ACTIVE" && s.branchIds.includes(branchId));
  const physioEmptyMessage = !branchId
    ? "Select a branch first"
    : staff.length === 0
      ? "No staff have been added yet"
      : "No active physiotherapists in this branch";
  const branchResources = resources.filter((r) => r.branchId === branchId && r.status === "ACTIVE");

  const { items: patientMatches, loading: patientSearchLoading } = usePatientSearch(patientQuery, branchId);
  const selectedPatient = patients.find((p) => p.id === patientId);

  function selectService(nextServiceId: string) {
    setServiceId(nextServiceId);
    const next = services.find((item) => item.id === nextServiceId);
    if (next) setEndTime(addMinutes(startTime, next.duration));
  }

  function updateStartTime(nextStart: string) {
    const previousDuration = Math.max(0, minutesBetween(startTime, endTime));
    setStartTime(nextStart);
    setEndTime(addMinutes(nextStart, previousDuration || service?.duration || 0));
  }

  function adjustEndTime(delta: number) {
    setEndTime((current) => addMinutes(current, delta));
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!patientId) e.patientId = "Select a patient";
    if (!date) e.date = "Required";
    // A visit that has already happened is recorded by moving an existing
    // appointment through its statuses, not by booking one behind today.
    else if (date < today()) e.date = "An appointment cannot be booked in the past";
    if (!accessibleBranches.some((b) => b.id === branchId)) e.branchId = "Select a branch";
    if (!startTime || !endTime || minutesBetween(startTime, endTime) <= 0) e.time = "End time must be after start time";
    if (!branchPhysios.some((p) => p.id === physioId)) {
      e.physioId = branchPhysios.length ? "Select physiotherapist" : physioEmptyMessage;
    }
    if (!serviceId) e.serviceId = "Required";
    if (!resourceId) e.resourceId = "Required";
    setFieldErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setError(null);
    if (!validate()) return;
    setSaving(true);
    const result = await addAppointment({
      patientId, date, startTime, endTime, branchId,
      physiotherapistId: physioId, serviceId, resourceId, note: note || undefined,
    });
    setSaving(false);
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
        description="Choose a time, select a service and preview your appointment block"
        actions={
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
        }
      />

      <form onSubmit={handleSubmit} className="grid items-start gap-6 pb-10 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
        <Card className="relative z-20 overflow-visible">
          <CardHeader><CardTitle className="text-base">1. Patient</CardTitle></CardHeader>
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
              <div className="relative z-30">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={patientQuery}
                    onChange={(e) => setPatientQuery(e.target.value)}
                    placeholder="Search patient by HN, name or phone..."
                    className="pl-9"
                  />
                </div>
                {patientSearchLoading && <p className="mt-2 text-xs text-muted-foreground">Searching patients…</p>}
                {patientMatches.length > 0 && (
                  <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-72 overflow-y-auto rounded-lg border border-border bg-popover shadow-lg ring-1 ring-black/5">
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
          <CardHeader><CardTitle className="text-base">2. Appointment block</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input type="date" min={today()} value={date} onChange={(e) => setDate(e.target.value)} />
                {fieldErrors.date && <p className="text-xs text-destructive">{fieldErrors.date}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Start Time</Label>
                <Input type="time" value={startTime} onChange={(e) => updateStartTime(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>End Time <span className="font-normal text-muted-foreground">(adjustable)</span></Label>
                <div className="flex gap-1">
                  <Button type="button" variant="outline" size="icon" className="shrink-0" onClick={() => adjustEndTime(-15)} aria-label="Reduce 15 minutes"><Minus className="h-3.5 w-3.5" /></Button>
                  <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
                  <Button type="button" variant="outline" size="icon" className="shrink-0" onClick={() => adjustEndTime(15)} aria-label="Add 15 minutes"><Plus className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            </div>
            {fieldErrors.time && <p role="alert" className="text-xs text-destructive">{fieldErrors.time}</p>}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Branch</Label>
                <Select value={branchId} onValueChange={(v) => { setBranchId(v); setPhysioId(""); setResourceId(""); }}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {accessibleBranches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                {fieldErrors.branchId && <p className="text-xs text-destructive">{fieldErrors.branchId}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="appointment-physiotherapist">Physiotherapist</Label>
                <Select value={physioId} onValueChange={setPhysioId}>
                  <SelectTrigger
                    id="appointment-physiotherapist"
                    className="w-full"
                    aria-describedby={branchPhysios.length === 0 ? "physiotherapist-help" : undefined}
                    aria-invalid={!!fieldErrors.physioId}
                  ><SelectValue placeholder={branchPhysios.length ? "Select physiotherapist" : physioEmptyMessage} /></SelectTrigger>
                  <SelectContent position="popper" align="start">
                    {branchPhysios.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    {branchPhysios.length === 0 && (
                      <SelectItem value="no-physiotherapists" disabled>{physioEmptyMessage}</SelectItem>
                    )}
                  </SelectContent>
                </Select>
                {branchPhysios.length === 0 && (
                  <div id="physiotherapist-help" className="space-y-1 text-xs text-muted-foreground">
                    <p>{can("settings.manage")
                      ? "Add an active physiotherapist and assign them to this branch."
                      : "Ask an administrator to add an active physiotherapist to this branch."}</p>
                    {can("settings.manage") && (
                      <a href="/settings/staff-access" target="_blank" rel="noopener noreferrer" className="inline-block text-primary underline underline-offset-4">
                        Manage staff (opens in a new tab)
                      </a>
                    )}
                  </div>
                )}
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

        <Card>
          <CardHeader>
            <CardTitle className="text-base">3. Choose what goes in this block</CardTitle>
            <p className="text-sm text-muted-foreground">Search or browse a category. Selecting a service sets the duration; you can adjust it above.</p>
          </CardHeader>
          <CardContent>
            <ServicePicker inline services={services.filter((s) => s.status === "ACTIVE")} value={serviceId} onValueChange={selectService} />
            {fieldErrors.serviceId && <p role="alert" className="mt-2 text-xs text-destructive">{fieldErrors.serviceId}</p>}
          </CardContent>
        </Card>
        </div>
        <aside className="space-y-4 xl:sticky xl:top-6">
          <Card className="overflow-hidden">
            <CardHeader className="bg-muted/30">
              <CardTitle className="flex items-center gap-2 text-base"><CalendarDays className="h-4 w-4" /> Block preview</CardTitle>
              <p className="text-xs text-muted-foreground">Review before creating the appointment</p>
            </CardHeader>
            <CardContent className="space-y-5 pt-5">
              <div className="rounded-xl border border-primary/20 border-l-4 border-l-primary bg-primary/5 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-primary"><Clock className="h-4 w-4" />{startTime || "—"} – {endTime || "—"}</p>
                <p className="mt-3 font-semibold">{selectedPatient ? getPatientFullNameTh(selectedPatient) : "Select a patient"}</p>
                <p className="mt-1 text-sm text-muted-foreground">{service?.name ?? "Select service"}</p>
                <p className="mt-3 text-xs text-muted-foreground">{staff.find((p) => p.id === physioId)?.name ?? "Select physiotherapist"}</p>
              </div>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Date</dt><dd>{date || "—"}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Branch</dt><dd className="text-right">{branches.find((b) => b.id === branchId)?.name ?? "—"}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Room / Resource</dt><dd className="text-right">{branchResources.find((r) => r.id === resourceId)?.name ?? "—"}</dd></div>
                <div className="flex justify-between gap-4 border-t pt-3"><dt className="text-muted-foreground">Duration</dt><dd>{Math.max(0, minutesBetween(startTime, endTime)) || 0} min</dd></div>
              </dl>
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
          <Button type="submit" disabled={saving}>{saving ? "Creating…" : "Create Appointment"}</Button>
        </div>
        </aside>
      </form>
    </>
  );
}

function minutesBetween(start: string, end: string) {
  const [startHour, startMinute] = start.split(":").map(Number);
  const [endHour, endMinute] = end.split(":").map(Number);
  return (endHour * 60 + endMinute) - (startHour * 60 + startMinute);
}

export default function NewAppointmentPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <NewAppointmentContent />
    </Suspense>
  );
}
