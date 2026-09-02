"use client";

import { useSyncExternalStore } from "react";
import { CalendarOff } from "lucide-react";
import { getPatientFullNameTh } from "@/lib/domain";
import { appointmentStatusMeta } from "@/components/appointments/appointment-status";
import { cn } from "@/lib/utils";
import type { Appointment, Patient, ResourceRoom, Service, Staff } from "@/types";

const START_HOUR = 8;
const END_HOUR = 19;
const PX_PER_MIN = 1.4;
const HOUR_HEIGHT = 60 * PX_PER_MIN;
const TOTAL_HEIGHT = (END_HOUR - START_HOUR) * HOUR_HEIGHT;
const HEADER_HEIGHT = 48;
const RULER_WIDTH = 56;
/** The 08:00 label is centred on its gridline, so the track needs room above it. */
const TRACK_INSET_TOP = 14;
const TRACK_INSET_BOTTOM = 24;

const hours = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** 24-hour, matching how every appointment time is written elsewhere in the app. */
function hourLabel(h: number): string {
  return `${String(h).padStart(2, "0")}:00`;
}

/**
 * The "now" line ticks once a minute. Reading the clock through
 * useSyncExternalStore keeps it out of render as a side effect and gives the
 * server a null snapshot, so the first client paint matches the prerendered
 * markup instead of hydrating with a different time.
 */
function subscribeToMinute(onChange: () => void) {
  const id = setInterval(onChange, 60_000);
  return () => clearInterval(id);
}

function minuteSnapshot(): number {
  return Math.floor(Date.now() / 60_000);
}

function serverSnapshot(): null {
  return null;
}

function offsetFor(minutes: number): number | null {
  const offset = (minutes - START_HOUR * 60) * PX_PER_MIN;
  return offset >= 0 && offset <= TOTAL_HEIGHT ? offset : null;
}

export function AppointmentTimeGrid({
  physios,
  appointments,
  patients,
  services,
  resources,
  date,
  today,
  onSelect,
}: {
  physios: Staff[];
  appointments: Appointment[];
  patients: Patient[];
  services: Service[];
  resources: ResourceRoom[];
  date: string;
  today: string;
  onSelect: (id: string) => void;
}) {
  const isToday = date === today;
  const epochMinute = useSyncExternalStore(subscribeToMinute, minuteSnapshot, serverSnapshot);

  let minutes: number | null = null;
  if (isToday && epochMinute !== null) {
    const clock = new Date(epochMinute * 60_000);
    minutes = clock.getHours() * 60 + clock.getMinutes();
  }

  const nowOffset = minutes === null ? null : offsetFor(minutes);
  const nowLabel =
    minutes === null
      ? null
      : `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

  if (physios.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card p-10 text-center">
        <CalendarOff className="mb-3 h-6 w-6 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm font-medium text-foreground">No physiotherapist to show</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Change the branch or physiotherapist filter to see a schedule.
        </p>
      </div>
    );
  }

  return (
    /* The app shell's content wrapper is not height-bounded, so `flex-1` alone
       would let the grid grow and hand scrolling back to the page — which would
       scroll the physiotherapist names out of view. Capping against the viewport
       (app header + page padding + page header + toolbar ≈ 19rem) keeps the
       scroll inside the grid so the column headers stay pinned. */
    <div className="relative flex min-h-[26rem] flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xs max-h-[calc(100dvh-19rem)]">
      {appointments.length === 0 && (
        <div
          className="pointer-events-none absolute inset-x-0 top-1/2 z-30 flex -translate-y-1/2 flex-col items-center px-6 text-center"
          role="status"
        >
          <div className="rounded-xl border border-border bg-card/95 px-5 py-4 shadow-sm">
            <CalendarOff className="mx-auto mb-2 h-5 w-5 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm font-medium text-foreground">Nothing booked for this day</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Use New Appointment to add one, or pick another date above.
            </p>
          </div>
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-auto overscroll-contain">
        <div className="flex min-w-full">
          {/* Time ruler — stays put while the grid scrolls sideways. */}
          <div
            className="sticky left-0 z-20 shrink-0 border-r border-border bg-card"
            style={{ width: RULER_WIDTH }}
          >
            <div
              className="sticky top-0 z-30 border-b border-border bg-card"
              style={{ height: HEADER_HEIGHT }}
            />
            <div
              className="relative"
              style={{ height: TOTAL_HEIGHT, marginTop: TRACK_INSET_TOP, marginBottom: TRACK_INSET_BOTTOM }}
            >
              {hours.map((h, i) => (
                <span
                  key={h}
                  className="absolute right-2 -translate-y-1/2 text-[11px] font-medium tabular-nums text-muted-foreground"
                  style={{ top: i * HOUR_HEIGHT }}
                >
                  {hourLabel(h)}
                </span>
              ))}
              {nowOffset !== null && nowLabel && (
                <span
                  className="absolute right-1 z-10 -translate-y-1/2 rounded bg-destructive px-1 py-px text-[10px] font-semibold tabular-nums text-destructive-foreground"
                  style={{ top: nowOffset }}
                >
                  {nowLabel}
                </span>
              )}
            </div>
          </div>

          {/* One column per physiotherapist. Columns grow to fill the width when
              only a few are shown, and scroll horizontally once they can't. */}
          {physios.map((phy) => {
            const items = appointments.filter((a) => a.physiotherapistId === phy.id);
            return (
              <div
                key={phy.id}
                className="min-w-[212px] flex-1 border-r border-border last:border-r-0"
              >
                <div
                  className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-card px-3"
                  style={{ height: HEADER_HEIGHT }}
                >
                  <span className={cn("h-2 w-2 shrink-0 rounded-full", phy.avatarColor)} aria-hidden="true" />
                  <p className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{phy.name}</p>
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">
                    {items.length}
                  </span>
                </div>

                <div
                  className="relative"
                  style={{ height: TOTAL_HEIGHT, marginTop: TRACK_INSET_TOP, marginBottom: TRACK_INSET_BOTTOM }}
                >
                  {hours.map((h, i) => (
                    <div key={h}>
                      <div
                        className="absolute inset-x-0 border-t border-border"
                        style={{ top: i * HOUR_HEIGHT }}
                      />
                      {h < END_HOUR && (
                        <div
                          className="absolute inset-x-0 border-t border-border/40"
                          style={{ top: i * HOUR_HEIGHT + HOUR_HEIGHT / 2 }}
                        />
                      )}
                    </div>
                  ))}

                  {nowOffset !== null && (
                    <div
                      className="pointer-events-none absolute inset-x-0 z-10 h-px bg-destructive"
                      style={{ top: nowOffset }}
                      aria-hidden="true"
                    />
                  )}

                  {items.map((a) => {
                    const start = toMinutes(a.startTime);
                    const end = toMinutes(a.endTime);
                    const top = (start - START_HOUR * 60) * PX_PER_MIN;
                    const height = Math.max((end - start) * PX_PER_MIN, 34);
                    const patient = patients.find((p) => p.id === a.patientId);
                    const svc = services.find((s) => s.id === a.serviceId);
                    const room = resources.find((r) => r.id === a.resourceId);
                    const meta = appointmentStatusMeta[a.status];
                    const StatusIcon = meta.icon;
                    const patientName = patient ? getPatientFullNameTh(patient) : "Unknown patient";
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => onSelect(a.id)}
                        title={`${a.startTime}–${a.endTime} · ${patientName} · ${meta.label}`}
                        aria-label={`${a.startTime} to ${a.endTime}, ${patientName}, ${svc?.name ?? "appointment"}, ${meta.label}`}
                        className={cn(
                          "group absolute inset-x-1.5 flex flex-col overflow-hidden rounded-lg border pl-2.5 pr-2 py-1.5 text-left transition-colors",
                          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                          a.status === "CANCELLED" && "opacity-70",
                          meta.block
                        )}
                        style={{ top, height }}
                      >
                        <span
                          className={cn("absolute inset-y-0 left-0 w-1 rounded-l-lg", meta.rail)}
                          aria-hidden="true"
                        />
                        <span className="flex items-center gap-1.5">
                          <StatusIcon className="h-3 w-3 shrink-0 text-foreground/70" aria-hidden="true" />
                          <span className="truncate text-[11px] font-semibold tabular-nums text-foreground/80">
                            {a.startTime}–{a.endTime}
                          </span>
                        </span>
                        <span
                          className={cn(
                            "truncate text-[13px] font-medium text-foreground",
                            a.status === "CANCELLED" && "line-through"
                          )}
                        >
                          {patientName}
                        </span>
                        {height > 62 && (
                          <span className="truncate text-[11px] text-muted-foreground">
                            {svc?.name}
                            {room ? ` · ${room.name}` : ""}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
