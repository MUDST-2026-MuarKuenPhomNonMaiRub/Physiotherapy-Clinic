"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarPlus,
  Check,
  Clock,
  DoorOpen,
  MapPin,
  Play,
  ShoppingCart,
  StickyNote,
  User,
  UserX,
  XCircle,
} from "lucide-react";
import { useClinicStore } from "@/lib/store/clinic-store";
import { useSession } from "@/lib/auth/use-session";
import { getPatientFullNameTh } from "@/lib/domain";
import { formatDate } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { AppointmentStatus } from "@/types";
import { toast } from "sonner";

const stepOrder: AppointmentStatus[] = ["CONFIRMED", "ARRIVED", "IN_SERVICE", "COMPLETED"];
const stepLabels: Record<string, string> = {
  CONFIRMED: "Confirmed", ARRIVED: "Arrived", IN_SERVICE: "In Service", COMPLETED: "Completed",
};

export default function AppointmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { can } = useSession();
  const appointments = useClinicStore((s) => s.appointments);
  const patients = useClinicStore((s) => s.patients);
  const staff = useClinicStore((s) => s.staff);
  const services = useClinicStore((s) => s.services);
  const resources = useClinicStore((s) => s.resources);
  const branches = useClinicStore((s) => s.branches);
  const checkInAppointment = useClinicStore((s) => s.checkInAppointment);
  const startService = useClinicStore((s) => s.startService);
  const completeService = useClinicStore((s) => s.completeService);
  const cancelAppointment = useClinicStore((s) => s.cancelAppointment);
  const markNoShow = useClinicStore((s) => s.markNoShow);
  const rescheduleAppointment = useClinicStore((s) => s.rescheduleAppointment);

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [noShowOpen, setNoShowOpen] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [newStart, setNewStart] = useState("");
  const [rescheduleReason, setRescheduleReason] = useState("");

  const apt = appointments.find((a) => a.id === id);
  if (!apt) notFound();

  const patient = patients.find((p) => p.id === apt.patientId);
  const physio = staff.find((s) => s.id === apt.physiotherapistId);
  const service = services.find((s) => s.id === apt.serviceId);
  const room = resources.find((r) => r.id === apt.resourceId);
  const branch = branches.find((b) => b.id === apt.branchId);
  const isTerminalAlt = ["CANCELLED", "NO_SHOW", "RESCHEDULED"].includes(apt.status);
  const canOperate = can("appointment.edit");
  const canFrontDeskOps = can("appointment.cancel");

  /** Runs a status change and reports it, so a rejected move is never silent. */
  async function runTransition(action: Promise<void>, message: string, onDone?: () => void) {
    try {
      await action;
      onDone?.();
      toast.success(message);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update this appointment");
    }
  }

  async function doReschedule() {
    if (!newDate || !newStart || !service) return;
    const [h, m] = newStart.split(":").map(Number);
    const endMin = h * 60 + m + service.duration;
    const newEnd = `${String(Math.floor(endMin / 60) % 24).padStart(2, "0")}:${String(endMin % 60).padStart(2, "0")}`;
    try {
      const created = await rescheduleAppointment(
        apt!.id, newDate, newStart, newEnd, rescheduleReason.trim() || undefined
      );
      setRescheduleOpen(false);
      setRescheduleReason("");
      if (created) {
        toast.success("Appointment rescheduled");
        router.push(`/appointments/${created.id}`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to reschedule");
    }
  }

  return (
    <>
      <Link href="/appointments" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Appointments
      </Link>

      <PageHeader
        title={patient ? getPatientFullNameTh(patient) : "Appointment"}
        description={`${service?.name ?? ""} · ${formatDate(apt.date)}, ${apt.startTime}–${apt.endTime}`}
        actions={<StatusBadge status={apt.status} className="text-sm" />}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="mb-3 text-sm font-semibold text-foreground">Visit Details</h3>
            <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <Detail icon={User} label="Patient" value={patient ? `${getPatientFullNameTh(patient)} (${patient.hn})` : "—"} link={patient ? `/patients/${patient.id}` : undefined} />
              <Detail icon={Clock} label="Date & Time" value={`${formatDate(apt.date)}, ${apt.startTime}–${apt.endTime}`} />
              <Detail icon={User} label="Physiotherapist" value={physio?.name ?? "—"} />
              <Detail icon={DoorOpen} label="Room" value={room?.name ?? "—"} />
              <Detail icon={MapPin} label="Branch" value={branch?.name ?? "—"} />
              <Detail label="Service" value={service?.name ?? "—"} />
            </dl>
            {apt.note && (
              <div className="mt-4 flex items-start gap-2 rounded-lg bg-muted/50 px-3 py-2.5 text-sm text-muted-foreground">
                <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {apt.note}
              </div>
            )}
          </div>

          {!isTerminalAlt && (
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="mb-4 text-sm font-semibold text-foreground">Status Timeline</h3>
              <div className="flex items-center">
                {stepOrder.map((step, i) => {
                  const currentIdx = stepOrder.indexOf(apt.status);
                  const done = i <= currentIdx;
                  return (
                    <div key={step} className="flex flex-1 items-center last:flex-none">
                      <div className="flex flex-col items-center gap-1.5">
                        <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                          {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                        </div>
                        <span className={`text-xs ${done ? "font-medium text-foreground" : "text-muted-foreground"}`}>{stepLabels[step]}</span>
                      </div>
                      {i < stepOrder.length - 1 && (
                        <div className={`mx-2 h-0.5 flex-1 rounded ${i < currentIdx ? "bg-primary" : "bg-muted"}`} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="mb-3 text-sm font-semibold text-foreground">Actions</h3>
            <div className="flex flex-col gap-2">
              {apt.status === "CONFIRMED" && (
                <>
                  {canFrontDeskOps && (
                    <Button onClick={() => void runTransition(checkInAppointment(apt.id), "Patient checked in")}>
                      <Check className="h-4 w-4" /> Check-in
                    </Button>
                  )}
                  {canFrontDeskOps && (
                    <Button variant="outline" onClick={() => { setNewDate(apt.date); setNewStart(apt.startTime); setRescheduleReason(""); setRescheduleOpen(true); }}>
                      Reschedule
                    </Button>
                  )}
                  {canFrontDeskOps && (
                    <Button variant="outline" onClick={() => setNoShowOpen(true)}>
                      <UserX className="h-4 w-4" /> Mark No Show
                    </Button>
                  )}
                  {canFrontDeskOps && (
                    <Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => setCancelOpen(true)}>
                      <XCircle className="h-4 w-4" /> Cancel
                    </Button>
                  )}
                </>
              )}
              {apt.status === "ARRIVED" && (
                canOperate ? (
                  <Button onClick={() => void runTransition(startService(apt.id), "Service started")}>
                    <Play className="h-4 w-4" /> Start Service
                  </Button>
                ) : (
                  <p className="text-sm text-muted-foreground">Patient has been checked in and is waiting. The physiotherapist will start the service.</p>
                )
              )}
              {apt.status === "IN_SERVICE" && (
                canOperate ? (
                  <Button onClick={() => void runTransition(completeService(apt.id), "Service completed")}>
                    <Check className="h-4 w-4" /> Complete Service
                  </Button>
                ) : (
                  <p className="text-sm text-muted-foreground">Treatment is in progress. The physiotherapist will mark it complete.</p>
                )
              )}
              {apt.status === "COMPLETED" && (
                <>
                  {!apt.checkedOut && can("checkout.create") && (
                    <Button asChild>
                      <Link href={`/checkout?patientId=${apt.patientId}&appointmentId=${apt.id}`}>
                        <ShoppingCart className="h-4 w-4" /> Proceed to Checkout
                      </Link>
                    </Button>
                  )}
                  {apt.checkedOut && (
                    <p className="rounded-lg bg-success/10 px-3 py-2 text-xs font-medium text-success">
                      This visit has been checked out.
                    </p>
                  )}
                  {can("appointment.create") && (
                    <Button variant="outline" asChild>
                      <Link href={`/appointments/new?patientId=${apt.patientId}`}>
                        <CalendarPlus className="h-4 w-4" /> Book Next Appointment
                      </Link>
                    </Button>
                  )}
                </>
              )}
              {isTerminalAlt && (
                <p className="text-sm text-muted-foreground">
                  {apt.status === "CANCELLED" && "This appointment was cancelled."}
                  {apt.status === "NO_SHOW" && "Patient did not show up for this appointment."}
                  {apt.status === "RESCHEDULED" && "This appointment was rescheduled to a new time."}
                </p>
              )}
              {!canOperate && !canFrontDeskOps && (
                <p className="text-sm text-muted-foreground">You have view-only access to this appointment.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={noShowOpen}
        onOpenChange={setNoShowOpen}
        title="Mark as No Show?"
        description="This appointment will be marked as No Show. This action can be reviewed later in reports."
        confirmLabel="Mark No Show"
        destructive
        onConfirm={() => void runTransition(markNoShow(apt.id), "Marked as No Show", () => setNoShowOpen(false))}
      />

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Appointment</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Reason</Label>
            <Textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="e.g. Patient requested cancellation" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>Back</Button>
            <Button
              variant="destructive"
              disabled={!cancelReason.trim()}
              onClick={() => void runTransition(cancelAppointment(apt.id, cancelReason.trim()), "Appointment cancelled", () => setCancelOpen(false))}
            >
              Cancel Appointment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rescheduleOpen} onOpenChange={setRescheduleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reschedule Appointment</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>New Date</Label>
              <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>New Start Time</Label>
              <Input type="time" value={newStart} onChange={(e) => setNewStart(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Reason / Note</Label>
            <Textarea
              value={rescheduleReason}
              onChange={(e) => setRescheduleReason(e.target.value)}
              placeholder="e.g. Patient requested reschedule by phone"
              rows={2}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRescheduleOpen(false)}>Cancel</Button>
            <Button onClick={doReschedule} disabled={!newDate || !newStart}>Confirm Reschedule</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Detail({
  icon: Icon,
  label,
  value,
  link,
}: {
  icon?: typeof User;
  label: string;
  value: string;
  link?: string;
}) {
  const content = (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2">
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {label}
      </span>
      <span className="text-right text-sm font-medium text-foreground">{value}</span>
    </div>
  );
  if (link) return <Link href={link}>{content}</Link>;
  return content;
}
