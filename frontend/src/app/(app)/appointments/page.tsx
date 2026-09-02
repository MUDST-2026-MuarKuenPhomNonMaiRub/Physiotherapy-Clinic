"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, List, Plus } from "lucide-react";
import { useClinicStore } from "@/lib/store/clinic-store";
import { useSession } from "@/lib/auth/use-session";
import { useBranchScope } from "@/lib/auth/use-branch-scope";
import { getPatientFullNameTh } from "@/lib/domain";
import { formatDate } from "@/lib/format";
import { today } from "@/lib/domain";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { TableScrollArea } from "@/components/shared/table-scroll-area";
import { AppointmentTimeGrid } from "@/components/appointments/appointment-time-grid";
import { BranchFilterSelect } from "@/components/shared/branch-filter-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { AppointmentStatus } from "@/types";

const statusOptions: { value: AppointmentStatus | "ALL"; label: string }[] = [
  { value: "ALL", label: "All Statuses" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "ARRIVED", label: "Arrived" },
  { value: "IN_SERVICE", label: "In Service" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "RESCHEDULED", label: "Rescheduled" },
  { value: "NO_SHOW", label: "No Show" },
];

function AppointmentsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { activeBranchId, can } = useSession();
  const { isAccessible } = useBranchScope();
  const appointments = useClinicStore((s) => s.appointments);
  const patients = useClinicStore((s) => s.patients);
  const staff = useClinicStore((s) => s.staff);
  const services = useClinicStore((s) => s.services);
  const resources = useClinicStore((s) => s.resources);
  const branches = useClinicStore((s) => s.branches);

  const [view, setView] = useState<"list" | "calendar">(searchParams.get("view") === "calendar" ? "calendar" : "list");
  const [dateFilter, setDateFilter] = useState(view === "calendar" ? today() : "");
  const [branchFilter, setBranchFilter] = useState(activeBranchId ?? "ALL");
  const [physioFilter, setPhysioFilter] = useState("ALL");
  const [serviceFilter, setServiceFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState<AppointmentStatus | "ALL">("ALL");

  const physios = staff.filter((s) => s.position === "Physiotherapist");

  const filtered = useMemo(() => {
    return appointments
      .filter((a) => (view === "calendar" ? a.date === (dateFilter || today()) : dateFilter ? a.date === dateFilter : true))
      .filter((a) => (branchFilter === "ALL" ? isAccessible(a.branchId) : a.branchId === branchFilter))
      .filter((a) => physioFilter === "ALL" || a.physiotherapistId === physioFilter)
      .filter((a) => serviceFilter === "ALL" || a.serviceId === serviceFilter)
      .filter((a) => statusFilter === "ALL" || a.status === statusFilter)
      .sort((a, b) => `${a.date}T${a.startTime}`.localeCompare(`${b.date}T${b.startTime}`));
  }, [appointments, view, dateFilter, branchFilter, physioFilter, serviceFilter, statusFilter, isAccessible]);

  const calendarPhysios = branchFilter === "ALL" ? physios : physios.filter((p) => p.branchIds.includes(branchFilter));

  return (
    <>
      <PageHeader
        title="Appointments & Visits"
        description="Manage bookings, check-ins and treatment progress"
        actions={
          can("appointment.create") ? (
            <Button onClick={() => router.push("/appointments/new")}>
              <Plus className="h-4 w-4" /> New Appointment
            </Button>
          ) : undefined
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center rounded-lg border border-border bg-muted/40 p-0.5">
          <button
            onClick={() => setView("list")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${view === "list" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground"}`}
          >
            <List className="h-3.5 w-3.5" /> List
          </button>
          <button
            onClick={() => { setView("calendar"); if (!dateFilter) setDateFilter(today()); }}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${view === "calendar" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground"}`}
          >
            <CalendarDays className="h-3.5 w-3.5" /> Calendar
          </button>
        </div>

        <Input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="w-40"
        />
        {view === "calendar" && (
          <Button variant="outline" size="sm" onClick={() => setDateFilter(today())}>
            Today
          </Button>
        )}
        <p className="ml-auto text-sm text-muted-foreground">{filtered.length} appointments</p>
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <BranchFilterSelect value={branchFilter} onValueChange={setBranchFilter} className="w-44" />
        <Select value={physioFilter} onValueChange={setPhysioFilter}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Physiotherapist" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Physiotherapists</SelectItem>
            {physios.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={serviceFilter} onValueChange={setServiceFilter}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Service" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Services</SelectItem>
            {services.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {view === "list" && (
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as AppointmentStatus | "ALL")}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              {statusOptions.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={CalendarDays} title="No appointments found" description="Try adjusting your filters or create a new appointment." />
      ) : view === "list" ? (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <TableScrollArea>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Physiotherapist</TableHead>
                  <TableHead>Room</TableHead>
                  <TableHead className="hidden min-[1400px]:table-cell">Branch</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((a) => {
                  const patient = patients.find((p) => p.id === a.patientId);
                  const svc = services.find((s) => s.id === a.serviceId);
                  const phy = staff.find((s) => s.id === a.physiotherapistId);
                  const room = resources.find((r) => r.id === a.resourceId);
                  const br = branches.find((b) => b.id === a.branchId);
                  return (
                    <TableRow key={a.id} className="cursor-pointer" onClick={() => router.push(`/appointments/${a.id}`)}>
                      <TableCell>{formatDate(a.date)}</TableCell>
                      <TableCell>{a.startTime} – {a.endTime}</TableCell>
                      <TableCell>
                        <p className="font-medium text-foreground">{patient ? getPatientFullNameTh(patient) : "—"}</p>
                        <p className="font-mono text-xs text-muted-foreground">{patient?.hn}</p>
                      </TableCell>
                      <TableCell>{svc?.name}</TableCell>
                      <TableCell>{phy?.name}</TableCell>
                      <TableCell className="text-muted-foreground">{room?.name}</TableCell>
                      <TableCell className="hidden text-muted-foreground min-[1400px]:table-cell">{br?.code}</TableCell>
                      <TableCell><StatusBadge status={a.status} /></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableScrollArea>
        </div>
      ) : (
        <AppointmentTimeGrid
          key={dateFilter || today()}
          physios={calendarPhysios}
          appointments={filtered}
          patients={patients}
          services={services}
          resources={resources}
          date={dateFilter || today()}
          today={today()}
          onSelect={(id) => router.push(`/appointments/${id}`)}
        />
      )}
    </>
  );
}

export default function AppointmentsPage() {
  return (
    <Suspense>
      <AppointmentsPageContent />
    </Suspense>
  );
}
