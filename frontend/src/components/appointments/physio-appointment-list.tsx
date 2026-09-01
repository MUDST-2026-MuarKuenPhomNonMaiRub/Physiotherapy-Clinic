"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, Clock, DoorOpen, Droplet, MapPin, Phone, UserRound } from "lucide-react";
import type { Appointment, Patient } from "@/types";
import { useClinicStore } from "@/lib/store/clinic-store";
import { getPatientFullNameEn, getPatientFullNameTh } from "@/lib/mock-data/patients";
import { calcAge, formatDate } from "@/lib/format";
import { remainingSessions } from "@/lib/mock-data/course-data";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const avatarPalette = ["bg-blue-600", "bg-emerald-600", "bg-teal-600", "bg-indigo-600", "bg-violet-600", "bg-rose-600"];

function avatarColor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return avatarPalette[hash % avatarPalette.length];
}

function initials(p: Patient) {
  const a = p.firstNameEn?.[0] ?? p.firstNameTh?.[0] ?? "";
  const b = p.lastNameEn?.[0] ?? p.lastNameTh?.[0] ?? "";
  return (a + b).toUpperCase() || "?";
}

export function PhysioAppointmentList({ list, showDate }: { list: Appointment[]; showDate: boolean }) {
  const patients = useClinicStore((s) => s.patients);
  const services = useClinicStore((s) => s.services);
  const resources = useClinicStore((s) => s.resources);
  const branches = useClinicStore((s) => s.branches);
  const patientCourses = useClinicStore((s) => s.patientCourses);
  const courseTemplates = useClinicStore((s) => s.courseTemplates);
  const startService = useClinicStore((s) => s.startService);

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const groups = useMemo(() => {
    if (!showDate) return list.length ? [{ date: list[0].date, items: list }] : [];
    const map = new Map<string, Appointment[]>();
    for (const a of list) {
      if (!map.has(a.date)) map.set(a.date, []);
      map.get(a.date)!.push(a);
    }
    return Array.from(map.entries()).map(([date, items]) => ({ date, items }));
  }, [list, showDate]);

  const selected = list.find((a) => a.id === selectedId);
  const selectedPatient = selected ? patients.find((p) => p.id === selected.patientId) : undefined;
  const selectedService = selected ? services.find((s) => s.id === selected.serviceId) : undefined;
  const selectedRoom = selected ? resources.find((r) => r.id === selected.resourceId) : undefined;
  const selectedBranch = selected ? branches.find((b) => b.id === selected.branchId) : undefined;
  const selectedCourses = selectedPatient
    ? patientCourses.filter((pc) => pc.patientId === selectedPatient.id && pc.status === "ACTIVE")
    : [];

  if (list.length === 0) {
    return <EmptyState icon={CalendarDays} title="No appointments" description="Nothing to show in this view." />;
  }

  return (
    <>
      <div className="space-y-6">
        {groups.map((group) => (
          <div key={group.date}>
            {showDate && (
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {formatDate(group.date)}
              </p>
            )}
            <div className="space-y-3 border-l-2 border-border pl-5">
              {group.items.map((a) => {
                const patient = patients.find((p) => p.id === a.patientId);
                const svc = services.find((s) => s.id === a.serviceId);
                const room = resources.find((r) => r.id === a.resourceId);
                return (
                  <div key={a.id} className="relative">
                    <span className="absolute -left-[27px] top-5 h-2.5 w-2.5 rounded-full border-2 border-card bg-primary" />
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedId(a.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelectedId(a.id);
                        }
                      }}
                      className="flex w-full cursor-pointer flex-wrap items-center gap-4 rounded-xl border border-border bg-card p-4 text-left shadow-xs transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
                    >
                      <div className="flex w-20 shrink-0 flex-col">
                        <span className="text-sm font-semibold text-foreground">{a.startTime}</span>
                        <span className="text-xs text-muted-foreground">{a.endTime}</span>
                      </div>

                      {patient && (
                        <span
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ${avatarColor(patient.id)}`}
                        >
                          {initials(patient)}
                        </span>
                      )}

                      <div className="min-w-40 flex-1">
                        <p className="text-sm font-semibold text-foreground">{patient ? getPatientFullNameTh(patient) : "—"}</p>
                        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span className="font-mono">{patient?.hn}</span>
                          <span>·</span>
                          <span>{svc?.name}</span>
                        </p>
                      </div>

                      {room && (
                        <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
                          <DoorOpen className="h-3.5 w-3.5" /> {room.name}
                        </span>
                      )}

                      <StatusBadge status={a.status} />

                      {a.status === "ARRIVED" && (
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            startService(a.id);
                          }}
                        >
                          Start Service
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelectedId(null)}>
        <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-md">
          {selected && selectedPatient && (
            <>
              <SheetHeader className="border-b border-border pb-4">
                <div className="flex items-center gap-3">
                  <span
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-base font-semibold text-white ${avatarColor(selectedPatient.id)}`}
                  >
                    {initials(selectedPatient)}
                  </span>
                  <div>
                    <SheetTitle>{getPatientFullNameTh(selectedPatient)}</SheetTitle>
                    <SheetDescription>
                      {getPatientFullNameEn(selectedPatient)} · {calcAge(selectedPatient.dob)} yrs ·{" "}
                      {selectedPatient.gender === "MALE" ? "Male" : selectedPatient.gender === "FEMALE" ? "Female" : "Other"}
                    </SheetDescription>
                  </div>
                </div>
              </SheetHeader>

              <div className="flex-1 space-y-5 overflow-y-auto p-4">
                <section>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">This Appointment</p>
                  <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-3.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" /> Time
                      </span>
                      <span className="font-medium text-foreground">
                        {formatDate(selected.date)} · {selected.startTime}–{selected.endTime}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Service</span>
                      <span className="font-medium text-foreground">{selectedService?.name}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <DoorOpen className="h-3.5 w-3.5" /> Room
                      </span>
                      <span className="font-medium text-foreground">{selectedRoom?.name}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5" /> Branch
                      </span>
                      <span className="font-medium text-foreground">{selectedBranch?.name}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Status</span>
                      <StatusBadge status={selected.status} />
                    </div>
                    {selected.note && (
                      <p className="rounded-lg bg-card px-2.5 py-2 text-xs text-muted-foreground">{selected.note}</p>
                    )}
                  </div>
                </section>

                <section>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Patient</p>
                  <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-3.5 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">HN</span>
                      <span className="rounded-md bg-primary/5 px-2 py-0.5 font-mono text-xs font-semibold text-primary">
                        {selectedPatient.hn}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <Phone className="h-3.5 w-3.5" /> Phone
                      </span>
                      <span className="font-medium text-foreground">{selectedPatient.phone}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <Droplet className="h-3.5 w-3.5" /> Blood Group
                      </span>
                      <span className="font-medium text-foreground">{selectedPatient.bloodGroup}</span>
                    </div>
                  </div>
                </section>

                <section>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Course Balance</p>
                  {selectedCourses.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No active course package.</p>
                  ) : (
                    <div className="space-y-2.5">
                      {selectedCourses.map((pc) => {
                        const tmpl = courseTemplates.find((c) => c.id === pc.courseId);
                        const purchased = pc.purchased + pc.bonus;
                        const remaining = remainingSessions(pc);
                        const pct = purchased > 0 ? Math.round((remaining / purchased) * 100) : 0;
                        return (
                          <div key={pc.id} className="rounded-xl border border-border p-3">
                            <p className="text-sm font-medium text-foreground">{tmpl?.name ?? "Course"}</p>
                            <Progress value={pct} className="mt-2 h-1.5" />
                            <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground">
                              <span>Purchased {purchased}</span>
                              <span>Used {pc.used}</span>
                              <span className="font-medium text-foreground">{remaining} left</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              </div>

              <SheetFooter className="flex-row border-t border-border">
                <Button variant="outline" className="flex-1" asChild>
                  <Link href={`/patients/${selectedPatient.id}`}>
                    <UserRound className="h-4 w-4" /> Full Profile
                  </Link>
                </Button>
                {selected.status === "ARRIVED" ? (
                  <Button
                    className="flex-1"
                    onClick={() => {
                      startService(selected.id);
                      setSelectedId(null);
                    }}
                  >
                    Start Service
                  </Button>
                ) : (
                  <Button variant="outline" className="flex-1" asChild>
                    <Link href={`/appointments/${selected.id}`}>View Appointment</Link>
                  </Button>
                )}
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
