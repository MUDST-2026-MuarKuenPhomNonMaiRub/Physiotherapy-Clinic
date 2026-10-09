import {
  Activity,
  CalendarCheck,
  CheckCircle2,
  CircleSlash,
  RefreshCw,
  TriangleAlert,
  UserCheck,
  type LucideIcon,
} from "lucide-react";
import type { AppointmentStatus } from "@/types";

/**
 * Status is never carried by colour alone — every surface that shows one pairs
 * the tint with an icon and a label (WCAG 1.4.1). Shared between the calendar
 * toolbar summary and the schedule blocks so the two never drift apart.
 */
export interface AppointmentStatusMeta {
  label: string;
  icon: LucideIcon;
  /** Block appearance inside the schedule grid. */
  block: string;
  /** Left rail that carries the status colour on the block. */
  rail: string;
  /** Small solid swatch used in the summary strip. */
  dot: string;
  /** Icon tint in the summary strip. */
  tint: string;
}

export const appointmentStatusMeta: Record<AppointmentStatus, AppointmentStatusMeta> = {
  CONFIRMED: {
    label: "Confirmed",
    icon: CalendarCheck,
    block: "border-info/30 bg-info/8 hover:border-info/50",
    rail: "bg-info",
    dot: "bg-info",
    tint: "text-[#1A9DBF]",
  },
  ARRIVED: {
    label: "Arrived",
    icon: UserCheck,
    block: "border-primary/30 bg-primary/8 hover:border-primary/50",
    rail: "bg-primary",
    dot: "bg-primary",
    tint: "text-primary",
  },
  IN_SERVICE: {
    label: "In service",
    icon: Activity,
    block: "border-warning/40 bg-warning/12 hover:border-warning/60",
    rail: "bg-warning",
    dot: "bg-warning",
    tint: "text-[#8A5A00]",
  },
  COMPLETED: {
    label: "Completed",
    icon: CheckCircle2,
    block: "border-success/30 bg-success/8 hover:border-success/50",
    rail: "bg-success",
    dot: "bg-success",
    tint: "text-success",
  },
  CANCELLED: {
    label: "Cancelled",
    icon: CircleSlash,
    block: "border-border bg-muted hover:border-muted-foreground/40",
    rail: "bg-muted-foreground/50",
    dot: "bg-muted-foreground/50",
    tint: "text-muted-foreground",
  },
  RESCHEDULED: {
    label: "Rescheduled",
    icon: RefreshCw,
    block: "border-warning/30 bg-warning/8 hover:border-warning/50",
    rail: "bg-warning",
    dot: "bg-warning",
    tint: "text-[#8A5A00]",
  },
  NO_SHOW: {
    label: "No show",
    icon: TriangleAlert,
    block: "border-destructive/30 bg-destructive/8 hover:border-destructive/50",
    rail: "bg-destructive",
    dot: "bg-destructive",
    tint: "text-destructive",
  },
};

/** Order the day summary reads in — the arc of a visit, left to right. */
export const summaryStatuses: AppointmentStatus[] = [
  "CONFIRMED",
  "ARRIVED",
  "IN_SERVICE",
  "COMPLETED",
  "NO_SHOW",
];
