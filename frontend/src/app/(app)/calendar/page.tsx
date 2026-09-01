"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useClinicStore } from "@/lib/store/clinic-store";
import { useSession } from "@/lib/auth/use-session";
import { useBranchScope } from "@/lib/auth/use-branch-scope";
import { TODAY } from "@/lib/mock-data/course-data";
import { PageHeader } from "@/components/shared/page-header";
import { AppointmentTimeGrid } from "@/components/appointments/appointment-time-grid";
import {
  appointmentStatusMeta,
  summaryStatuses,
} from "@/components/appointments/appointment-status";
import { BranchFilterSelect } from "@/components/shared/branch-filter-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** "Wednesday, 12 August 2026" — the weekday is what staff actually orient by. */
function formatDayHeading(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function CalendarPage() {
  const router = useRouter();
  const { user, activeBranchId, can } = useSession();
  const { isAccessible } = useBranchScope();
  const appointments = useClinicStore((s) => s.appointments);
  const patients = useClinicStore((s) => s.patients);
  const staff = useClinicStore((s) => s.staff);
  const services = useClinicStore((s) => s.services);
  const resources = useClinicStore((s) => s.resources);

  const [date, setDate] = useState(TODAY);
  const [branchFilter, setBranchFilter] = useState(activeBranchId ?? "ALL");
  // A physiotherapist lands on their own column; an admin sees the whole floor.
  const [physioFilter, setPhysioFilter] = useState(
    user?.role === "PHYSIOTHERAPIST" && user.staffId ? user.staffId : "ALL"
  );

  const physios = useMemo(
    () => staff.filter((s) => s.position === "Physiotherapist" && s.status === "ACTIVE"),
    [staff]
  );

  const dayAppointments = useMemo(
    () =>
      appointments
        .filter((a) => a.date === date)
        .filter((a) => (branchFilter === "ALL" ? isAccessible(a.branchId) : a.branchId === branchFilter))
        .filter((a) => physioFilter === "ALL" || a.physiotherapistId === physioFilter),
    [appointments, date, branchFilter, physioFilter, isAccessible]
  );

  const columnPhysios = useMemo(() => {
    const inBranch = branchFilter === "ALL" ? physios : physios.filter((p) => p.branchIds.includes(branchFilter));
    return physioFilter === "ALL" ? inBranch : inBranch.filter((p) => p.id === physioFilter);
  }, [physios, branchFilter, physioFilter]);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    dayAppointments.forEach((a) => map.set(a.status, (map.get(a.status) ?? 0) + 1));
    return map;
  }, [dayAppointments]);

  const isToday = date === TODAY;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title="Calendar"
        description={formatDayHeading(date)}
        className="mb-4"
        actions={
          can("appointment.create") ? (
            <Button
              size="lg"
              className="h-11 sm:h-9"
              onClick={() => router.push("/appointments/new")}
            >
              <Plus className="h-4 w-4" /> New Appointment
            </Button>
          ) : undefined
        }
      />

      <div className="mb-4 shrink-0 overflow-hidden rounded-xl border border-border bg-card shadow-xs">
        {/* Controls: date on the left, scope filters on the right. */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 p-3">
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon-lg"
              className="h-11 w-11 sm:h-9 sm:w-9"
              onClick={() => setDate(shiftDate(date, -1))}
              aria-label="Previous day"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon-lg"
              className="h-11 w-11 sm:h-9 sm:w-9"
              onClick={() => setDate(shiftDate(date, 1))}
              aria-label="Next day"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <Input
            type="date"
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            aria-label="Schedule date"
            className="h-11 w-[9.5rem] sm:h-9"
          />

          <Button
            variant={isToday ? "secondary" : "outline"}
            size="lg"
            className="h-11 sm:h-9"
            onClick={() => setDate(TODAY)}
            aria-pressed={isToday}
          >
            <CalendarDays className="h-4 w-4" /> Today
          </Button>

          <div className="ml-auto flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Label htmlFor="branch-filter" className="text-xs text-muted-foreground">
                Branch
              </Label>
              <BranchFilterSelect
                value={branchFilter}
                onValueChange={setBranchFilter}
                className="w-44 data-[size=default]:h-11 sm:data-[size=default]:h-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="physio-filter" className="text-xs text-muted-foreground">
                Physiotherapist
              </Label>
              <Select value={physioFilter} onValueChange={setPhysioFilter}>
                <SelectTrigger
                  id="physio-filter"
                  className="w-52 data-[size=default]:h-11 sm:data-[size=default]:h-9"
                >
                  <SelectValue placeholder="Physiotherapist" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All physiotherapists</SelectItem>
                  {physios.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Day summary. Each status carries an icon and a word, never colour alone. */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border bg-muted/40 px-3 py-2">
          <p className="text-sm font-semibold text-foreground">
            {dayAppointments.length}{" "}
            <span className="font-normal text-muted-foreground">
              {dayAppointments.length === 1 ? "appointment" : "appointments"}
            </span>
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            {summaryStatuses.map((status) => {
              const meta = appointmentStatusMeta[status];
              const Icon = meta.icon;
              const value = counts.get(status) ?? 0;
              return (
                <span
                  key={status}
                  className={cn(
                    "flex items-center gap-1.5 text-xs",
                    value === 0 ? "text-muted-foreground/60" : "text-foreground"
                  )}
                >
                  <Icon
                    className={cn("h-3.5 w-3.5 shrink-0", value === 0 ? "" : meta.tint)}
                    aria-hidden="true"
                  />
                  {meta.label}
                  <span className="font-semibold tabular-nums">{value}</span>
                </span>
              );
            })}
          </div>
        </div>
      </div>

      <AppointmentTimeGrid
        physios={columnPhysios}
        appointments={dayAppointments}
        patients={patients}
        services={services}
        resources={resources}
        date={date}
        today={TODAY}
        onSelect={(id) => router.push(`/appointments/${id}`)}
      />
    </div>
  );
}
