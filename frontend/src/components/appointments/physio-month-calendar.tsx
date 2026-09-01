"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getPatientFullNameTh } from "@/lib/mock-data/patients";
import { AppointmentCard } from "@/components/appointments/appointment-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CalendarDays } from "lucide-react";
import type { Appointment, Patient, Service } from "@/types";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const STATUS_DOT: Record<string, string> = {
  CONFIRMED: "bg-info",
  ARRIVED: "bg-primary",
  IN_SERVICE: "bg-warning",
  COMPLETED: "bg-success",
  CANCELLED: "bg-muted-foreground",
  RESCHEDULED: "bg-warning",
  NO_SHOW: "bg-destructive",
};

const MAX_CHIPS_PER_DAY = 3;

export function PhysioMonthCalendar({
  appointments,
  patients,
  services,
  today,
}: {
  appointments: Appointment[];
  patients: Patient[];
  services: Service[];
  today: string;
}) {
  const [month, setMonth] = useState(() => startOfMonth(new Date(`${today}T00:00:00`)));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const days = useMemo(() => {
    const gridStart = startOfWeek(startOfMonth(month));
    const gridEnd = endOfWeek(endOfMonth(month));
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [month]);

  const byDate = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const a of appointments) {
      const list = map.get(a.date) ?? [];
      list.push(a);
      map.set(a.date, list);
    }
    for (const list of map.values()) list.sort((a, b) => a.startTime.localeCompare(b.startTime));
    return map;
  }, [appointments]);

  const selectedList = selectedDate ? (byDate.get(selectedDate) ?? []) : [];

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">{format(month, "MMMM yyyy")}</h3>
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setMonth((m) => subMonths(m, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setMonth(startOfMonth(new Date(`${today}T00:00:00`)))}>
            Today
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setMonth((m) => addMonths(m, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="grid grid-cols-7 border-b border-border bg-muted/40">
          {WEEKDAY_LABELS.map((d) => (
            <div key={d} className="px-2 py-2 text-center text-xs font-semibold text-muted-foreground">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const dateStr = format(day, "yyyy-MM-dd");
            const inMonth = isSameMonth(day, month);
            const dayAppointments = byDate.get(dateStr) ?? [];
            const overflow = dayAppointments.length - MAX_CHIPS_PER_DAY;
            return (
              <button
                key={dateStr}
                type="button"
                onClick={() => dayAppointments.length > 0 && setSelectedDate(dateStr)}
                className={`flex min-h-24 flex-col gap-1 border-b border-r border-border p-1.5 text-left last:border-r-0 sm:min-h-28 ${
                  inMonth ? "bg-card" : "bg-muted/20"
                } ${dayAppointments.length > 0 ? "cursor-pointer hover:bg-muted/40" : "cursor-default"}`}
              >
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-medium ${
                    isToday(day)
                      ? "bg-primary text-primary-foreground"
                      : inMonth
                        ? "text-foreground"
                        : "text-muted-foreground/50"
                  }`}
                >
                  {format(day, "d")}
                </span>
                <div className="flex flex-col gap-0.5">
                  {dayAppointments.slice(0, MAX_CHIPS_PER_DAY).map((a) => {
                    const patient = patients.find((p) => p.id === a.patientId);
                    return (
                      <span
                        key={a.id}
                        className="flex items-center gap-1 truncate rounded bg-muted/60 px-1 py-0.5 text-[11px] text-foreground"
                      >
                        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT[a.status] ?? "bg-muted-foreground"}`} />
                        <span className="truncate">
                          {a.startTime} {patient ? getPatientFullNameTh(patient) : ""}
                        </span>
                      </span>
                    );
                  })}
                  {overflow > 0 && (
                    <span className="px-1 text-[11px] font-medium text-muted-foreground">+{overflow} more</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <Dialog open={!!selectedDate} onOpenChange={(open) => !open && setSelectedDate(null)}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedDate ? format(new Date(`${selectedDate}T00:00:00`), "EEEE, d MMMM yyyy") : ""}
            </DialogTitle>
          </DialogHeader>
          {selectedList.length === 0 ? (
            <EmptyState icon={CalendarDays} title="No appointments" description="Nothing scheduled on this day." />
          ) : (
            <div className="space-y-2">
              {selectedList.map((a) => {
                const patient = patients.find((p) => p.id === a.patientId);
                const svc = services.find((s) => s.id === a.serviceId);
                return (
                  <Link key={a.id} href={`/appointments/${a.id}`} onClick={() => setSelectedDate(null)}>
                    <AppointmentCard
                      time={`${a.startTime} – ${a.endTime}`}
                      patientName={patient ? getPatientFullNameTh(patient) : "—"}
                      patientHn={patient?.hn}
                      serviceName={svc?.name ?? ""}
                      status={a.status}
                    />
                  </Link>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
