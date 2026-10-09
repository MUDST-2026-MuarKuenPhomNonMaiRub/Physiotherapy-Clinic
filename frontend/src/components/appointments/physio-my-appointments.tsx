"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowRight, CalendarCheck, Clock } from "lucide-react";
import { useClinicStore } from "@/lib/store/clinic-store";
import { getPatientFullNameTh, today } from "@/lib/domain";
import { PhysioMonthCalendar } from "@/components/appointments/physio-month-calendar";
import { PhysioAppointmentList } from "@/components/appointments/physio-appointment-list";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function longDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function PhysioMyAppointments({ staffId }: { staffId: string }) {
  const appointments = useClinicStore((s) => s.appointments);
  const patients = useClinicStore((s) => s.patients);
  const services = useClinicStore((s) => s.services);

  const mine = useMemo(() => appointments.filter((a) => a.physiotherapistId === staffId), [appointments, staffId]);

  const currentDate = today();
  const todayLong = longDate(currentDate);
  const todaysAppointments = mine
    .filter((a) => a.date === currentDate)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
  const upcoming = mine
    .filter((a) => a.date > currentDate && ["CONFIRMED", "ARRIVED", "IN_SERVICE", "RESCHEDULED"].includes(a.status))
    .sort((a, b) => `${a.date}T${a.startTime}`.localeCompare(`${b.date}T${b.startTime}`));
  const completed = mine.filter((a) => a.status === "COMPLETED").sort((a, b) => `${b.date}T${b.startTime}`.localeCompare(`${a.date}T${a.startTime}`));

  const remainingToday = todaysAppointments.filter((a) => ["CONFIRMED", "ARRIVED", "IN_SERVICE"].includes(a.status)).length;
  const nextPatient = todaysAppointments.find((a) => ["CONFIRMED", "ARRIVED", "IN_SERVICE"].includes(a.status));
  const nextPatientRecord = nextPatient ? patients.find((p) => p.id === nextPatient.patientId) : undefined;
  const nextService = nextPatient ? services.find((s) => s.id === nextPatient.serviceId) : undefined;

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-gradient-to-br from-card to-muted/40 p-5 shadow-xs">
        <div className="flex items-center gap-3.5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <CalendarCheck className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">{todayLong}</p>
            <p className="text-sm text-muted-foreground">
              {todaysAppointments.length} appointment{todaysAppointments.length === 1 ? "" : "s"} today · {remainingToday} remaining
            </p>
          </div>
        </div>
        {nextPatient && nextPatientRecord && (
          <Link
            href={`/appointments/${nextPatient.id}`}
            className="group flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 py-2.5 pr-3 pl-3.5 transition-colors hover:bg-primary/10"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Clock className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                Next · {nextPatient.startTime}
              </p>
              <p className="text-sm font-semibold text-foreground">{getPatientFullNameTh(nextPatientRecord)}</p>
              <p className="text-xs text-muted-foreground">{nextService?.name}</p>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-primary opacity-0 transition-opacity group-hover:opacity-100" />
          </Link>
        )}
      </div>

      <Tabs defaultValue="today">
        <TabsList>
          <TabsTrigger value="today">Today ({todaysAppointments.length})</TabsTrigger>
          <TabsTrigger value="month">Month</TabsTrigger>
          <TabsTrigger value="upcoming">Upcoming ({upcoming.length})</TabsTrigger>
          <TabsTrigger value="completed">Completed ({completed.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="today">
          <PhysioAppointmentList list={todaysAppointments} showDate={false} />
        </TabsContent>
        <TabsContent value="month">
          <PhysioMonthCalendar appointments={mine} patients={patients} services={services} today={currentDate} />
        </TabsContent>
        <TabsContent value="upcoming">
          <PhysioAppointmentList list={upcoming} showDate />
        </TabsContent>
        <TabsContent value="completed">
          <PhysioAppointmentList list={completed} showDate />
        </TabsContent>
      </Tabs>
    </>
  );
}
