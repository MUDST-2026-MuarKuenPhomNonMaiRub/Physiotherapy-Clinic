"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type PointerEvent as ReactPointerEvent } from "react";
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

function toTime(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/** Drags snap to quarter hours, as Google Calendar does. */
const SNAP_MINUTES = 15;
/** A press that travels less than this is a click that opens the booking, not a drag. */
const DRAG_THRESHOLD_PX = 4;
/** Statuses that no longer hold their slot, so they never block a drop. */
const RELEASED = ["CANCELLED", "RESCHEDULED", "NO_SHOW"];

interface Drag {
  id: string;
  /** The column the block started in. */
  physioId: string;
  /** The column under the pointer — another physiotherapist when dragged across. */
  targetPhysioId: string;
  /** "move" shifts the whole block; "resize" moves only its end. */
  mode: "move" | "resize";
  pointerId: number;
  /** Where the press started, in the grid's content (scroll-independent) coordinates. */
  originY: number;
  fromStart: number;
  fromEnd: number;
  start: number;
  end: number;
  moved: boolean;
}

/** How close to an edge of the grid, in px, the pointer must come to scroll it. */
const AUTO_SCROLL_EDGE = 56;
/**
 * Scroll speed, in px per second, with the pointer right at (or past) the
 * edge. Per second rather than per frame, so a slow machine or a throttled
 * tab scrolls as far in the same time, just in coarser steps.
 */
const AUTO_SCROLL_MAX = 960;
/** A frame that arrives later than this (a stalled tab) scrolls no further than this much time's worth. */
const AUTO_SCROLL_MAX_STEP_MS = 250;

/**
 * Scroll speed for one axis, in px per second: negative near the start edge,
 * positive near the end edge, faster the closer the pointer is, zero away
 * from both.
 */
function edgeSpeed(fromStart: number, fromEnd: number): number {
  if (fromStart < AUTO_SCROLL_EDGE)
    return -AUTO_SCROLL_MAX * (1 - Math.max(fromStart, 0) / AUTO_SCROLL_EDGE);
  if (fromEnd < AUTO_SCROLL_EDGE)
    return AUTO_SCROLL_MAX * (1 - Math.max(fromEnd, 0) / AUTO_SCROLL_EDGE);
  return 0;
}

/**
 * Where a drag stands with the pointer at (x, y) and the grid scrolled to
 * `scrollTop`. Measured against the content rather than the screen, so a grid
 * that scrolls under a still pointer moves the block with it. Null while a
 * press has not yet travelled far enough to count as a drag.
 */
function follow(
  drag: Drag,
  x: number,
  y: number,
  scrollTop: number,
  columns: Map<string, HTMLDivElement>
): Drag | null {
  const dy = y + scrollTop - drag.originY;
  if (!drag.moved && Math.abs(dy) < DRAG_THRESHOLD_PX) return null;
  const delta = Math.round(dy / PX_PER_MIN / SNAP_MINUTES) * SNAP_MINUTES;
  if (drag.mode === "resize") {
    const end = Math.min(Math.max(drag.fromEnd + delta, drag.fromStart + SNAP_MINUTES), END_HOUR * 60);
    return { ...drag, end, moved: true };
  }
  const length = drag.fromEnd - drag.fromStart;
  const start = Math.min(Math.max(drag.fromStart + delta, START_HOUR * 60), END_HOUR * 60 - length);
  let targetPhysioId = drag.targetPhysioId;
  for (const [physioId, column] of columns) {
    const rect = column.getBoundingClientRect();
    if (x >= rect.left && x < rect.right) targetPhysioId = physioId;
  }
  return { ...drag, start, end: start + length, targetPhysioId, moved: true };
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
  onCreate,
  onChangeTime,
}: {
  physios: Staff[];
  appointments: Appointment[];
  patients: Patient[];
  services: Service[];
  resources: ResourceRoom[];
  date: string;
  today: string;
  onSelect: (id: string) => void;
  onCreate?: (physioId: string, time: string) => void;
  /**
   * Turns on drag to move and resize, as in Google Calendar. A booked visit
   * moves by its body — into another physiotherapist's column to hand it
   * over — and stretches by its bottom edge; once the patient has arrived only
   * the end can stretch. `physioId` is passed only for a handover. Resolves once
   * the server has accepted the new slot, and rejects (the block springs back)
   * when it has not.
   */
  onChangeTime?: (id: string, startTime: string, endTime: string, physioId?: string) => Promise<void>;
}) {
  const isToday = date === today;
  const [drag, setDrag] = useState<Drag | null>(null);
  // The slot a dropped block shows while the server confirms it.
  const [pending, setPending] = useState<{ id: string; physioId: string; start: number; end: number } | null>(null);
  // The click that ends a drag must not also open the booking.
  const suppressClick = useRef(false);
  // Each physiotherapist's track, to tell which column the pointer is over.
  const columns = useRef(new Map<string, HTMLDivElement>());
  // The scrolling grid, and the last pointer position of a drag under way.
  const scroller = useRef<HTMLDivElement>(null);
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const editable = !!onChangeTime && date >= today;

  /** Whether a slot in a therapist's column would run into a booking that still holds its time. */
  const clashes = (physioId: string, id: string, start: number, end: number) =>
    appointments.some(
      (other) =>
        other.physiotherapistId === physioId &&
        other.id !== id &&
        !RELEASED.includes(other.status) &&
        toMinutes(other.startTime) < end &&
        toMinutes(other.endTime) > start
    );

  // The pointer is followed on the window rather than on the block: a block
  // dragged into another column is drawn there as a new element, and would
  // lose a capture held by the old one. Re-subscribed on every move so the
  // handlers always see the drag as it stands.
  useEffect(() => {
    if (!drag) return;
    const onMove = (event: PointerEvent) => {
      if (event.pointerId !== drag.pointerId) return;
      const next = follow(drag, event.clientX, event.clientY, scroller.current?.scrollTop ?? 0, columns.current);
      if (!next) return;
      pointer.current = { x: event.clientX, y: event.clientY };
      setDrag(next);
    };
    const onUp = (event: PointerEvent) => {
      if (event.pointerId !== drag.pointerId) return;
      setDrag(null);
      if (!drag.moved) return;
      // Swallow the click this release produces, but only this one.
      suppressClick.current = true;
      window.setTimeout(() => {
        suppressClick.current = false;
      }, 0);
      const handedOver = drag.targetPhysioId !== drag.physioId;
      const unchanged = !handedOver && drag.start === drag.fromStart && drag.end === drag.fromEnd;
      if (unchanged || clashes(drag.targetPhysioId, drag.id, drag.start, drag.end) || !onChangeTime) return;
      setPending({ id: drag.id, physioId: drag.targetPhysioId, start: drag.start, end: drag.end });
      void onChangeTime(drag.id, toTime(drag.start), toTime(drag.end), handedOver ? drag.targetPhysioId : undefined)
        .catch(() => undefined)
        .finally(() => setPending(null));
    };
    const onCancel = () => setDrag(null);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDrag(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      window.removeEventListener("keydown", onKey);
    };
  });

  // Holding a dragged block near an edge scrolls the grid that way — to reach
  // a physiotherapist off to the side, or an hour above or below the view —
  // faster the closer it is, as in Google Calendar. Runs once per frame for as
  // long as the drag lasts; the block follows the content as it scrolls.
  const dragKey = drag ? `${drag.id}|${drag.pointerId}|${drag.mode}` : null;
  useEffect(() => {
    if (!dragKey) return;
    const horizontal = dragKey.endsWith("|move");
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const seconds = Math.min(now - last, AUTO_SCROLL_MAX_STEP_MS) / 1000;
      last = now;
      const grid = scroller.current;
      const at = pointer.current;
      if (grid && at) {
        const box = grid.getBoundingClientRect();
        // The time ruler and the name row stay pinned over the content, so
        // the edges that scroll start inside them.
        const dx = Math.round(
          (horizontal ? edgeSpeed(at.x - (box.left + RULER_WIDTH), box.right - at.x) : 0) * seconds
        );
        const dy = Math.round(edgeSpeed(at.y - (box.top + HEADER_HEIGHT), box.bottom - at.y) * seconds);
        const left = grid.scrollLeft;
        const top = grid.scrollTop;
        if (dx) grid.scrollLeft += dx;
        if (dy) grid.scrollTop += dy;
        if (grid.scrollLeft !== left || grid.scrollTop !== top) {
          const scrollTop = grid.scrollTop;
          setDrag((current) =>
            current?.moved ? (follow(current, at.x, at.y, scrollTop, columns.current) ?? current) : current
          );
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      pointer.current = null;
    };
  }, [dragKey]);
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
              {onCreate ? "Click an empty time slot to add an appointment block." : "Use New Appointment to add one, or pick another date above."}
            </p>
          </div>
        </div>
      )}
      <div
        ref={scroller}
        className={cn("min-h-0 flex-1 overflow-auto overscroll-contain", drag?.moved && "cursor-grabbing select-none")}
      >
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
            // Where each block is drawn: a block being dragged (or saving) across
            // to another therapist is shown in that therapist's column.
            const columnOf = (a: Appointment) =>
              drag?.id === a.id && drag.moved
                ? drag.targetPhysioId
                : pending?.id === a.id
                  ? pending.physioId
                  : a.physiotherapistId;
            const shown = appointments.filter((a) => columnOf(a) === phy.id);
            const dropTarget = !!drag?.moved && drag.targetPhysioId === phy.id && drag.physioId !== phy.id;
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
                  ref={(element) => {
                    if (element) columns.current.set(phy.id, element);
                    else columns.current.delete(phy.id);
                  }}
                  className={cn("relative transition-colors", dropTarget && "bg-primary/5")}
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

                  {onCreate && date >= today && Array.from({ length: (END_HOUR - START_HOUR) * 2 }, (_, slot) => {
                    const time = `${String(START_HOUR + Math.floor(slot / 2)).padStart(2, "0")}:${slot % 2 ? "30" : "00"}`;
                    const occupied = items.some((item) => !["CANCELLED", "RESCHEDULED", "NO_SHOW"].includes(item.status) && toMinutes(item.startTime) < toMinutes(time) + 30 && toMinutes(item.endTime) > toMinutes(time));
                    if (occupied) return null;
                    return <button key={time} type="button" aria-label={`Add appointment ${phy.name} ${time}`} onClick={() => onCreate(phy.id, time)} className="group absolute inset-x-1 rounded-md text-left hover:bg-primary/5 focus-visible:bg-primary/10 focus-visible:outline-ring" style={{ top: slot * HOUR_HEIGHT / 2, height: HOUR_HEIGHT / 2 }}><span className="px-3 text-xs text-primary opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100">+ {time}</span></button>;
                  })}

                  {nowOffset !== null && (
                    <div
                      className="pointer-events-none absolute inset-x-0 z-10 h-px bg-destructive"
                      style={{ top: nowOffset }}
                      aria-hidden="true"
                    />
                  )}

                  {shown.map((a) => {
                    const dragging = drag?.id === a.id && drag.moved;
                    const saving = pending?.id === a.id;
                    const start = dragging ? drag.start : saving ? pending.start : toMinutes(a.startTime);
                    const end = dragging ? drag.end : saving ? pending.end : toMinutes(a.endTime);
                    const invalid = dragging && clashes(phy.id, a.id, start, end);
                    const canMove = editable && a.status === "CONFIRMED";
                    const canResize = editable && ["CONFIRMED", "ARRIVED", "IN_SERVICE"].includes(a.status);
                    const timeLabel = `${toTime(start)}–${toTime(end)}`;
                    const top = (start - START_HOUR * 60) * PX_PER_MIN;
                    // Leave a small visual gutter between back-to-back bookings
                    // so their borders and text never appear to merge.
                    const height = Math.max((end - start) * PX_PER_MIN - 2, 34);
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
                        onClick={() => {
                          if (suppressClick.current) {
                            suppressClick.current = false;
                            return;
                          }
                          onSelect(a.id);
                        }}
                        onPointerDown={(event: ReactPointerEvent<HTMLButtonElement>) => {
                          if (event.button !== 0 || saving) return;
                          const onHandle = !!(event.target as HTMLElement).closest("[data-resize-handle]");
                          // A finger on the body scrolls the grid; only the handle drags on touch.
                          const mode = onHandle ? "resize" : "move";
                          if (mode === "resize" ? !canResize : !canMove || event.pointerType === "touch") return;
                          setDrag({
                            id: a.id, physioId: phy.id, targetPhysioId: phy.id, mode,
                            pointerId: event.pointerId, originY: event.clientY + (scroller.current?.scrollTop ?? 0),
                            fromStart: toMinutes(a.startTime), fromEnd: toMinutes(a.endTime),
                            start: toMinutes(a.startTime), end: toMinutes(a.endTime), moved: false,
                          });
                        }}
                        aria-label={`${timeLabel}, ${patientName}, ${svc?.name ?? "appointment"}, ${meta.label}`}
                        title={
                          canMove ? "Drag to move or to another physiotherapist, drag the bottom edge to change the end time"
                            : canResize ? "Drag the bottom edge to change the end time" : undefined
                        }
                        className={cn(
                          "group absolute inset-x-1.5 flex flex-col justify-start gap-0.5 overflow-hidden rounded-lg border py-1.5 pl-2.5 pr-2 text-left transition-colors",
                          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                          a.status === "CANCELLED" && "opacity-70",
                          canMove && "cursor-grab",
                          dragging && "z-20 cursor-grabbing shadow-lg ring-2 ring-primary/60",
                          invalid && "ring-destructive",
                          saving && "cursor-wait opacity-60",
                          meta.block
                        )}
                        style={{ top, height }}
                      >
                        <span
                          className={cn("absolute inset-y-0 left-0 w-1 rounded-l-lg", meta.rail)}
                          aria-hidden="true"
                        />
                        <span className="flex h-3.5 shrink-0 items-center gap-1.5 leading-none">
                          <StatusIcon className="h-3 w-3 shrink-0 text-foreground/70" aria-hidden="true" />
                          <span
                            className={cn(
                              "truncate text-[11px] font-semibold leading-none tabular-nums text-foreground/80",
                              invalid && "text-destructive"
                            )}
                          >
                            {timeLabel}
                          </span>
                        </span>
                        <span
                          className={cn(
                            "block shrink-0 truncate text-[13px] font-medium leading-4 text-foreground",
                            a.status === "CANCELLED" && "line-through"
                          )}
                        >
                          {patientName}
                        </span>
                        {height > 62 && (
                          <span className="block shrink-0 truncate text-[11px] leading-4 text-muted-foreground">
                            {svc?.name}
                            {room ? ` · ${room.name}` : ""}
                          </span>
                        )}
                        {canResize && (
                          <span
                            data-resize-handle
                            aria-hidden="true"
                            className="absolute inset-x-0 bottom-0 flex h-2.5 cursor-ns-resize touch-none items-end justify-center pb-0.5"
                          >
                            <span className="h-1 w-8 rounded-full bg-foreground/20 opacity-0 transition-opacity group-hover:opacity-100" />
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
