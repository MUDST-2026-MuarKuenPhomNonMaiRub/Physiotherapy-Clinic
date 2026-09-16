"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarSync, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { getAppointmentCalendarSync, retryAppointmentCalendarSync } from "@/lib/api/clinic-api";
import { Button } from "@/components/ui/button";
import type { AppointmentCalendarSync } from "@/types";

const labels: Record<AppointmentCalendarSync["status"], string> = {
  PENDING: "Sending to Google Calendar…",
  SYNCED: "In the physiotherapist's Google Calendar",
  FAILED: "Could not reach Google Calendar",
  DELETED: "Removed from Google Calendar",
};

/**
 * Where this appointment stands in the physiotherapist's Google Calendar.
 * Rendered only when the therapist has a connection — an appointment with
 * no sync row shows nothing at all, so the screen is unchanged for a clinic
 * that never set Google up.
 */
export function AppointmentCalendarSyncBadge({ appointmentId, canRetry }: { appointmentId: string; canRetry: boolean }) {
  const [sync, setSync] = useState<AppointmentCalendarSync | null>(null);
  const [retrying, setRetrying] = useState(false);

  const load = useCallback(() => {
    getAppointmentCalendarSync(appointmentId)
      .then(setSync)
      .catch(() => setSync(null));
  }, [appointmentId]);

  useEffect(() => {
    load();
    // A push that is still queued settles within seconds; look again once.
    const timer = window.setTimeout(load, 6000);
    return () => window.clearTimeout(timer);
  }, [load]);

  if (!sync) return null;

  async function retry() {
    setRetrying(true);
    try {
      await retryAppointmentCalendarSync(appointmentId);
      toast.success("Queued for Google Calendar again");
      window.setTimeout(load, 4000);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not retry");
    } finally {
      setRetrying(false);
    }
  }

  const failed = sync.status === "FAILED";
  return (
    <div
      className={`mt-4 flex flex-wrap items-center gap-2 rounded-lg px-3 py-2 text-xs ${
        failed ? "border border-destructive/20 bg-destructive/10 text-destructive" : "bg-muted/50 text-muted-foreground"
      }`}
    >
      <CalendarSync className="h-3.5 w-3.5 shrink-0" />
      <span>{labels[sync.status]}</span>
      {failed && sync.lastError && <span className="truncate opacity-80">— {sync.lastError}</span>}
      {failed && canRetry && (
        <Button type="button" size="sm" variant="outline" className="ml-auto h-7" onClick={() => void retry()} disabled={retrying}>
          <RefreshCw className="h-3 w-3" /> Retry
        </Button>
      )}
    </div>
  );
}
