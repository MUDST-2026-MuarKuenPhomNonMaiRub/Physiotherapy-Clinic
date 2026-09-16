"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarSync, Unplug } from "lucide-react";
import { toast } from "sonner";
import {
  disconnectGoogleCalendar,
  getGoogleCalendarStatus,
  startGoogleCalendarConnect,
} from "@/lib/api/clinic-api";
import { useSession } from "@/lib/auth/use-session";
import { DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import type { GoogleCalendarStatus } from "@/types";

/**
 * The signed-in person's own Google Calendar link, in the account menu. Only
 * they can connect it (it is their Google login), so the entry is absent for
 * a login with no staff record. Appointments are pushed one way; nothing is
 * read back from Google.
 */
export function GoogleCalendarMenu() {
  const { user } = useSession();
  const [status, setStatus] = useState<GoogleCalendarStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const staffId = user?.staffId;

  const load = useCallback(() => {
    if (!staffId) return;
    getGoogleCalendarStatus()
      .then(setStatus)
      .catch(() => setStatus(null));
  }, [staffId]);

  useEffect(() => {
    load();
  }, [load]);

  if (!staffId || !status) return null;

  async function connect() {
    setBusy(true);
    try {
      const url = await startGoogleCalendarConnect();
      window.location.assign(url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not start the Google connection");
      setBusy(false);
    }
  }

  async function disconnect() {
    // A dialog cannot live inside the menu (it closes with it), so the
    // browser's own confirm is used, as the Staff screen does.
    if (
      !window.confirm(
        "Disconnect Google Calendar? Every clinic appointment LA BALANCE placed in your Google Calendar"
          + " will be removed, and new bookings will stop appearing there. You can connect again at any time."
      )
    )
      return;
    setBusy(true);
    try {
      await disconnectGoogleCalendar();
      toast.success("Google Calendar disconnected — your clinic appointments were removed from it");
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not disconnect Google Calendar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Google Calendar</DropdownMenuLabel>
      {!status.configured ? (
        <DropdownMenuItem disabled className="flex flex-col items-start whitespace-normal">
          <span className="text-sm">Not set up on this server</span>
          <span className="text-xs text-muted-foreground">Ask the administrator to add the Google client keys.</span>
        </DropdownMenuItem>
      ) : status.connected ? (
        <>
          <DropdownMenuItem disabled className="flex flex-col items-start whitespace-normal opacity-100">
            <span className="text-sm text-foreground">Connected · {status.googleEmail ?? "Google account"}</span>
            <span className="text-xs text-muted-foreground">
              {status.lastError
                ? `Last push failed: ${status.lastError}`
                : status.pending > 0
                  ? `${status.pending} appointment(s) syncing…`
                  : "Your appointments are pushed to your calendar."}
            </span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={(e) => { e.preventDefault(); void disconnect(); }}
            disabled={busy}
            className="flex items-center gap-2"
          >
            <Unplug className="h-4 w-4" /> {busy ? "Disconnecting…" : "Disconnect"}
          </DropdownMenuItem>
        </>
      ) : (
        <DropdownMenuItem onSelect={(e) => { e.preventDefault(); void connect(); }} disabled={busy} className="flex items-center gap-2">
          <CalendarSync className="h-4 w-4" /> {busy ? "Opening Google…" : "Connect Google Calendar"}
        </DropdownMenuItem>
      )}
    </>
  );
}
