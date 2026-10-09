import { cn } from "@/lib/utils";

type Tone = "success" | "warning" | "danger" | "info" | "neutral" | "primary";

const toneClasses: Record<Tone, string> = {
  success: "bg-success/10 text-success border-success/20",
  warning: "bg-warning/10 text-warning border-warning/20",
  danger: "bg-destructive/10 text-destructive border-destructive/20",
  info: "bg-info/10 text-info border-info/20",
  neutral: "bg-muted text-muted-foreground border-border",
  primary: "bg-primary/10 text-primary border-primary/20",
};

const statusToneMap: Record<string, Tone> = {
  // Appointment
  CONFIRMED: "info",
  ARRIVED: "primary",
  IN_SERVICE: "warning",
  COMPLETED: "success",
  CANCELLED: "neutral",
  RESCHEDULED: "warning",
  NO_SHOW: "danger",
  // Course
  ACTIVE: "success",
  EXPIRED: "neutral",
  USED_UP: "warning",
  // Transaction
  VOID: "danger",
  // Transfer request
  PENDING: "warning",
  APPROVED: "info",
  REJECTED: "danger",
  // Staff / setting
  INACTIVE: "neutral",
  // Commission
  TREATMENT: "success",
  SALES: "info",
};

const statusLabelMap: Record<string, string> = {
  CONFIRMED: "Confirmed",
  ARRIVED: "Arrived",
  IN_SERVICE: "In Service",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  RESCHEDULED: "Rescheduled",
  NO_SHOW: "No Show",
  ACTIVE: "Active",
  EXPIRED: "Expired",
  USED_UP: "Used Up",
  VOID: "Void",
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  INACTIVE: "Inactive",
  TREATMENT: "Treating Staff",
  SALES: "Salesperson",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const tone = statusToneMap[status] ?? "neutral";
  const label = statusLabelMap[status] ?? status;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        toneClasses[tone],
        className
      )}
    >
      <span
        className={cn("h-1.5 w-1.5 rounded-full", {
          "bg-success": tone === "success",
          "bg-warning": tone === "warning",
          "bg-destructive": tone === "danger",
          "bg-info": tone === "info",
          "bg-muted-foreground": tone === "neutral",
          "bg-primary": tone === "primary",
        })}
      />
      {label}
    </span>
  );
}
