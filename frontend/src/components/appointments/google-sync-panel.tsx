"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarCheck2, CalendarClock, CalendarOff, CalendarX2, RefreshCw } from "lucide-react";
import { useClinicStore } from "@/lib/store/clinic-store";
import { Button } from "@/components/ui/button";
import type { Appointment, GoogleSyncStatus } from "@/types";
import { toast } from "sonner";

const POLL_INTERVAL_MS = 3000;
const MAX_POLLS = 5;

const presentation: Record<
  GoogleSyncStatus,
  { label: string; hint: string; icon: typeof CalendarCheck2; tone: string }
> = {
  PENDING: {
    label: "Syncing…",
    hint: "Sending this appointment to the physiotherapist's Google Calendar.",
    icon: CalendarClock,
    tone: "bg-warning/15 text-warning-foreground dark:text-warning",
  },
  SYNCED: {
    label: "In Google Calendar",
    hint: "The event matches this appointment.",
    icon: CalendarCheck2,
    tone: "bg-success/10 text-success",
  },
  FAILED: {
    label: "Sync failed",
    hint: "It will be retried automatically, or you can retry now.",
    icon: CalendarX2,
    tone: "bg-destructive/10 text-destructive",
  },
  SKIPPED: {
    label: "Not synced",
    hint: "The physiotherapist has not connected Google Calendar.",
    icon: CalendarOff,
    tone: "bg-muted text-muted-foreground",
  },
  REMOVED: {
    label: "Removed from Google Calendar",
    hint: "The event was deleted when this appointment was cancelled.",
    icon: CalendarOff,
    tone: "bg-muted text-muted-foreground",
  },
  MOVED: {
    label: "Moved with the reschedule",
    hint: "The event now belongs to the new appointment.",
    icon: CalendarCheck2,
    tone: "bg-muted text-muted-foreground",
  },
};

/**
 * The appointment's Google Calendar copy. Syncing happens in the background
 * after booking, so a PENDING state is re-read a few times until it settles.
 */
export function GoogleSyncPanel({ appointment, canRetry }: { appointment: Appointment; canRetry: boolean }) {
  const refreshAppointment = useClinicStore((s) => s.refreshAppointment);
  const retryGoogleSync = useClinicStore((s) => s.retryGoogleSync);
  const [retrying, setRetrying] = useState(false);
  const sync = appointment.googleSync;
  const status = sync?.status;

  useEffect(() => {
    if (status !== "PENDING") return;
    let polls = 0;
    const timer = setInterval(() => {
      polls += 1;
      if (polls > MAX_POLLS) {
        clearInterval(timer);
        return;
      }
      refreshAppointment(appointment.id).catch(() => clearInterval(timer));
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [appointment.id, status, refreshAppointment]);

  // The integration is off on this server — say nothing.
  if (!sync || !status) return null;

  const view = presentation[status];
  const Icon = view.icon;
  const retryable = canRetry && (status === "FAILED" || status === "SKIPPED" || status === "SYNCED");

  async function retry() {
    setRetrying(true);
    try {
      await retryGoogleSync(appointment.id);
      const latest = useClinicStore.getState().appointments.find((a) => a.id === appointment.id);
      const outcome = latest?.googleSync?.status;
      if (outcome === "SYNCED") toast.success("Synced to Google Calendar");
      else if (outcome === "SKIPPED") toast.info("The physiotherapist has not connected Google Calendar");
      else toast.error(latest?.googleSync?.error ?? "Google Calendar sync did not succeed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not retry the sync");
    } finally {
      setRetrying(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="mb-3 text-sm font-semibold text-foreground">Google Calendar</h3>
      <div className={`flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm ${view.tone}`}>
        <Icon className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="min-w-0">
          <p className="font-medium">{view.label}</p>
          <p className="mt-0.5 text-xs opacity-80">
            {status === "FAILED" && sync.error ? sync.error : view.hint}
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {retryable && (
          <Button variant="outline" size="sm" disabled={retrying} onClick={() => void retry()}>
            <RefreshCw className={`h-3.5 w-3.5 ${retrying ? "animate-spin" : ""}`} />
            {status === "SYNCED" ? "Sync again" : "Retry sync"}
          </Button>
        )}
        {status === "SKIPPED" && (
          <Link href="/google-calendar" className="text-xs font-medium text-primary hover:underline">
            Google Calendar settings
          </Link>
        )}
      </div>
    </div>
  );
}
