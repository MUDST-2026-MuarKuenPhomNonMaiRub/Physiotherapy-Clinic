"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CalendarCheck2, CalendarDays, Info, Link2Off, ShieldCheck } from "lucide-react";
import * as api from "@/lib/api/clinic-api";
import { useSession } from "@/lib/auth/use-session";
import { formatDateTime } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { PageLoading } from "@/components/shared/page-loading";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { TableScrollArea } from "@/components/shared/table-scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { GoogleCalendarConnection, GoogleCalendarStatus } from "@/types";
import { toast } from "sonner";

/**
 * One place for the Google Calendar push: the signed-in person's own link,
 * what leaves the clinic, and — for an administrator — who is connected. The
 * account menu offers the same connect / disconnect in a hurry; Google sends
 * the browser back to the Calendar screen, which reports the outcome.
 */
export default function GoogleCalendarPage() {
  const { user, can } = useSession();
  const isAdmin = can("settings.manage");
  const hasStaffProfile = Boolean(user?.staffId);

  const [status, setStatus] = useState<GoogleCalendarStatus | null>(null);
  const [staff, setStaff] = useState<GoogleCalendarConnection[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmSelf, setConfirmSelf] = useState(false);
  const [confirmStaff, setConfirmStaff] = useState<GoogleCalendarConnection | null>(null);

  const load = useCallback(async () => {
    try {
      const [own, connections] = await Promise.all([
        hasStaffProfile ? api.getGoogleCalendarStatus() : Promise.resolve(null),
        isAdmin ? api.listGoogleCalendarConnections() : Promise.resolve([]),
      ]);
      setStatus(own);
      setStaff(connections);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load Google Calendar status");
    } finally {
      setLoaded(true);
    }
  }, [hasStaffProfile, isAdmin]);

  useEffect(() => {
    // load() only sets state after its own await, not synchronously on this render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function connect() {
    setBusy(true);
    try {
      window.location.assign(await api.startGoogleCalendarConnect());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not start the Google connection");
      setBusy(false);
    }
  }

  async function disconnect(staffId?: string, name?: string) {
    setBusy(true);
    try {
      await api.disconnectGoogleCalendar(staffId);
      toast.success(
        name
          ? `${name} was disconnected — their clinic appointments were removed from Google`
          : "Google Calendar disconnected — your clinic appointments were removed from it"
      );
      setConfirmSelf(false);
      setConfirmStaff(null);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not disconnect");
    } finally {
      setBusy(false);
    }
  }

  if (!loaded) return <PageLoading />;

  return (
    <>
      <PageHeader
        title="Google Calendar"
        description="Appointments you provide are added to your own Google Calendar and kept up to date automatically"
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5 lg:col-span-2">
          <h3 className="mb-4 text-sm font-semibold text-foreground">Your connection</h3>
          {status ? (
            <OwnConnection
              status={status}
              busy={busy}
              onConnect={() => void connect()}
              onDisconnect={() => setConfirmSelf(true)}
            />
          ) : (
            <Notice icon={Info}>
              This login has no staff profile, so it has no appointments of its own to sync.
            </Notice>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <ShieldCheck className="h-4 w-4 text-primary" /> What is shared with Google
          </h3>
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            <li>• Date, time, service, room and branch</li>
            <li>• The patient&apos;s nickname (or HN when there is none)</li>
            <li>• Appointment number and a link back to it</li>
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">
            Full names, phone numbers and notes never leave the clinic system. Changes are one-way:
            edit appointments here — an event edited in Google is overwritten by the next change.
          </p>
        </div>
      </div>

      {isAdmin && (
        <div className="mt-6 rounded-xl border border-border bg-card">
          <div className="border-b border-border px-5 py-4">
            <h3 className="text-sm font-semibold text-foreground">Connected staff</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Each person connects from their own account. Disconnecting removes the clinic&apos;s events from their calendar.
            </p>
          </div>
          <TableScrollArea>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff</TableHead>
                  <TableHead>Google account</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Connected</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {staff.map((person) => (
                  <TableRow key={person.staffId}>
                    <TableCell>
                      <p className="font-medium text-foreground">{person.staffName || `Staff #${person.staffId}`}</p>
                      <p className="text-xs text-muted-foreground">{person.position}</p>
                    </TableCell>
                    <TableCell className="text-sm">{person.googleEmail ?? "—"}</TableCell>
                    <TableCell>
                      <SyncBadge lastError={person.lastError} pending={person.pending} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {person.connectedAt ? formatDateTime(person.connectedAt) : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setConfirmStaff(person)}
                      >
                        Disconnect
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {staff.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                      Nobody has connected Google Calendar yet
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableScrollArea>
        </div>
      )}

      <ConfirmDialog
        open={confirmSelf}
        onOpenChange={setConfirmSelf}
        title="Disconnect Google Calendar?"
        description="Every clinic appointment placed in your Google Calendar will be removed, and new bookings will stop appearing there. You can connect again at any time."
        confirmLabel="Disconnect"
        destructive
        onConfirm={() => void disconnect()}
      />
      <ConfirmDialog
        open={confirmStaff !== null}
        onOpenChange={(open) => !open && setConfirmStaff(null)}
        title={`Disconnect ${confirmStaff?.staffName || "this person"}?`}
        description="Their clinic appointments will be removed from their Google Calendar, and new bookings will stop appearing there until they connect again."
        confirmLabel="Disconnect"
        destructive
        onConfirm={() => confirmStaff && void disconnect(confirmStaff.staffId, confirmStaff.staffName)}
      />
    </>
  );
}

function OwnConnection({
  status,
  busy,
  onConnect,
  onDisconnect,
}: {
  status: GoogleCalendarStatus;
  busy: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  if (!status.configured) {
    return (
      <Notice icon={Info}>
        Google Calendar is not set up on this server yet. An administrator needs to add
        GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to the server settings first.
      </Notice>
    );
  }
  if (!status.connected) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <CalendarDays className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Not connected</p>
            <p className="text-xs text-muted-foreground">Connect once and your upcoming bookings appear in Google Calendar.</p>
          </div>
        </div>
        <Button onClick={onConnect} disabled={busy}>Connect Google Calendar</Button>
      </div>
    );
  }

  const failing = Boolean(status.lastError);
  // Reconnecting only helps when Google stopped accepting the stored grant.
  const accessLost = /expired or was removed|invalid_grant|answered 401/i.test(status.lastError ?? "");
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${failing ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"}`}>
            {failing ? <AlertTriangle className="h-5 w-5" /> : <CalendarCheck2 className="h-5 w-5" />}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{status.googleEmail ?? "Google account"}</p>
            <p className="text-xs text-muted-foreground">
              {status.connectedAt ? `Connected ${formatDateTime(status.connectedAt)}` : "Connected"}
              {status.pending > 0 && ` · ${status.pending} appointment(s) syncing`}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {accessLost && <Button onClick={onConnect} disabled={busy}>Reconnect</Button>}
          <Button variant="outline" onClick={onDisconnect} disabled={busy}>
            <Link2Off className="h-4 w-4" /> Disconnect
          </Button>
        </div>
      </div>
      {failing && (
        <Notice icon={AlertTriangle} tone="destructive">
          Last push failed: {status.lastError}
          {accessLost ? " Press Reconnect to give access again." : " Use Retry on the appointment once the cause is fixed."}
        </Notice>
      )}
    </div>
  );
}

function SyncBadge({ lastError, pending }: { lastError: string | null; pending: number }) {
  if (lastError) return <Badge variant="destructive">Sync failing</Badge>;
  if (pending > 0) return <Badge variant="outline">{pending} syncing</Badge>;
  return <Badge className="bg-success/10 text-success">Connected</Badge>;
}

function Notice({
  icon: Icon,
  tone = "muted",
  children,
}: {
  icon: typeof Info;
  tone?: "muted" | "destructive";
  children: React.ReactNode;
}) {
  const colours = tone === "destructive" ? "bg-destructive/10 text-destructive" : "bg-muted/50 text-muted-foreground";
  return (
    <div className={`flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm ${colours}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <p>{children}</p>
    </div>
  );
}
