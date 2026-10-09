import type { ReactNode } from "react";
import { Clock, DoorOpen, MapPin, User } from "lucide-react";
import { StatusBadge } from "@/components/shared/status-badge";

export function AppointmentCard({
  time,
  patientName,
  patientHn,
  serviceName,
  physioName,
  roomName,
  branchName,
  status,
  note,
  actions,
  onClick,
}: {
  time: string;
  patientName: string;
  patientHn?: string;
  serviceName: string;
  physioName?: string;
  roomName?: string;
  branchName?: string;
  status: string;
  note?: string;
  actions?: ReactNode;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`rounded-xl border border-border bg-card p-3.5 ${onClick ? "cursor-pointer transition-shadow hover:shadow-sm" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          {time}
        </div>
        <StatusBadge status={status} />
      </div>
      <p className="mt-2 text-sm font-medium text-foreground">
        {patientName}
        {patientHn && <span className="ml-1.5 font-mono text-xs font-normal text-muted-foreground">{patientHn}</span>}
      </p>
      <p className="text-sm text-muted-foreground">{serviceName}</p>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {physioName && (
          <span className="flex items-center gap-1"><User className="h-3 w-3" />{physioName}</span>
        )}
        {roomName && (
          <span className="flex items-center gap-1"><DoorOpen className="h-3 w-3" />{roomName}</span>
        )}
        {branchName && (
          <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{branchName}</span>
        )}
      </div>
      {note && <p className="mt-2 rounded-md bg-muted/60 px-2 py-1 text-xs text-muted-foreground">{note}</p>}
      {actions && <div className="mt-3 flex flex-wrap gap-1.5">{actions}</div>}
    </div>
  );
}
