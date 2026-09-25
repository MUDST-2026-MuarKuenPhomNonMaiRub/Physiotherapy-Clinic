"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import type { GoogleCalendarStatus, StaffGoogleConnection } from "@/types";
import { toast } from "sonner";

/** Why the consent round trip came back without a link, as the callback reports it. */
const failureMessages: Record<string, string> = {
  denied: "Google access was not granted.",
  invalid_state: "The connection request expired. Please try again.",
  staff_mismatch: "This connection request belongs to a different account.",
  missing_scope: "Please allow access to Google Calendar events on the consent screen.",
  no_refresh_token: "Google did not grant offline access. Please try again.",
  not_configured: "Google Calendar sync is not configured on this server.",
  google_error: "Google could not complete the connection. Please try again.",
  invalid_request: "The connection request was incomplete. Please try again.",
};

function GoogleCalendarPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { can } = useSession();
  const isAdmin = can("settings.manage");

  const [status, setStatus] = useState<GoogleCalendarStatus | null>(null);
  const [staff, setStaff] = useState<StaffGoogleConnection[]>([]);
  const [busy, setBusy] = useState(false);
  const [confirmSelf, setConfirmSelf] = useState(false);
  const [confirmStaff, setConfirmStaff] = useState<StaffGoogleConnection | null>(null);
  const reported = useRef(false);

  const load = useCallback(async () => {
    try {
      const own = await api.getGoogleCalendarStatus();
      setStatus(own);
      if (isAdmin && own.enabled) setStaff(await api.listStaffGoogleConnections());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load Google Calendar status");
    }
  }, [isAdmin]);

  useEffect(() => {
    // load() only sets state after its own await, not synchronously on this render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  // Report the outcome of the Google round trip once, then tidy the address bar.
  useEffect(() => {
    const result = searchParams.get("status");
    if (!result || reported.current) return;
    reported.current = true;
    if (result === "connected") {
      toast.success("Google Calendar connected. Your upcoming appointments are being added.");
    } else {
      toast.error(failureMessages[searchParams.get("reason") ?? ""] ?? "Google Calendar was not connected.");
    }
    router.replace("/google-calendar");
  }, [searchParams, router]);

  async function connect() {
    setBusy(true);
    try {
      window.location.assign(await api.startGoogleCalendarConnect());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not start the Google connection");
      setBusy(false);
    }
  }

  async function disconnectSelf() {
    setBusy(true);
    try {
      await api.disconnectGoogleCalendar();
      toast.success("Google Calendar disconnected");
      setConfirmSelf(false);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not disconnect");
    } finally {
      setBusy(false);
    }
  }

  async function disconnectStaff(person: StaffGoogleConnection) {
    setBusy(true);
    try {
      await api.disconnectStaffGoogleCalendar(person.staffId);
      toast.success(`${person.staffName} was disconnected`);
      setConfirmStaff(null);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not disconnect");
    } finally {
      setBusy(false);
    }
  }

  if (!status) return <PageLoading />;

  return (
    <>
      <PageHeader
        title="Google Calendar"
        description="Appointments you provide are added to your own Google Calendar and kept up to date automatically"
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5 lg:col-span-2">
          <h3 className="mb-4 text-sm font-semibold text-foreground">Your connection</h3>
          <OwnConnection
            status={status}
            busy={busy}
            onConnect={() => void connect()}
            onDisconnect={() => setConfirmSelf(true)}
          />
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <ShieldCheck className="h-4 w-4 text-primary" /> What is shared with Google
          </h3>
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            <li>• Date, time, service, branch and room</li>
            <li>• Patient HN and nickname (or first name)</li>
            <li>• Appointment number</li>
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">
            Phone numbers, surnames and notes never leave the clinic system. Changes are one-way:
            edit appointments here, not in Google Calendar.
          </p>
        </div>
      </div>

      {isAdmin && status.enabled && (
        <div className="mt-6 rounded-xl border border-border bg-card">
          <div className="border-b border-border px-5 py-4">
            <h3 className="text-sm font-semibold text-foreground">Staff connections</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Each person connects from their own account. You can disconnect someone who has left.
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
                      <p className="font-medium text-foreground">{person.staffName}</p>
                      <p className="text-xs text-muted-foreground">{person.position}</p>
                    </TableCell>
                    <TableCell className="text-sm">{person.googleEmail ?? "—"}</TableCell>
                    <TableCell>
                      <ConnectionBadge connected={person.connected} status={person.status} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {person.connectedAt ? formatDateTime(person.connectedAt) : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {person.connected && (
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setConfirmStaff(person)}>
                          Disconnect
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {staff.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                      No staff accounts yet
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
        description="New and changed appointments will stop appearing in your Google Calendar. Events already there are kept."
        confirmLabel="Disconnect"
        destructive
        onConfirm={() => void disconnectSelf()}
      />
      <ConfirmDialog
        open={confirmStaff !== null}
        onOpenChange={(open) => !open && setConfirmStaff(null)}
        title={`Disconnect ${confirmStaff?.staffName ?? ""}?`}
        description="Their appointments will stop syncing until they connect again. Events already in their calendar are kept."
        confirmLabel="Disconnect"
        destructive
        onConfirm={() => confirmStaff && void disconnectStaff(confirmStaff)}
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
  if (!status.enabled) {
    return (
      <Notice icon={Info}>
        Google Calendar sync is not switched on for this clinic. An administrator needs to set the
        Google OAuth client in the server settings first.
      </Notice>
    );
  }
  if (!status.staffLinked) {
    return (
      <Notice icon={Info}>
        This account has no staff profile, so it has no appointments of its own to sync.
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
            <p className="text-xs text-muted-foreground">Connect once and your bookings appear in Google Calendar.</p>
          </div>
        </div>
        <Button onClick={onConnect} disabled={busy}>Connect Google Calendar</Button>
      </div>
    );
  }

  const needsReconnect = status.status === "REAUTH_REQUIRED";
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${needsReconnect ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"}`}>
            {needsReconnect ? <AlertTriangle className="h-5 w-5" /> : <CalendarCheck2 className="h-5 w-5" />}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{status.googleEmail ?? "Google account"}</p>
            <p className="text-xs text-muted-foreground">
              {status.connectedAt ? `Connected ${formatDateTime(status.connectedAt)}` : "Connected"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {needsReconnect && <Button onClick={onConnect} disabled={busy}>Reconnect</Button>}
          <Button variant="outline" onClick={onDisconnect} disabled={busy}>
            <Link2Off className="h-4 w-4" /> Disconnect
          </Button>
        </div>
      </div>
      {needsReconnect && (
        <Notice icon={AlertTriangle} tone="destructive">
          {status.lastError ?? "Google access has expired."} Appointments are not syncing until you reconnect.
        </Notice>
      )}
    </div>
  );
}

function ConnectionBadge({ connected, status }: { connected: boolean; status?: string }) {
  if (!connected) return <Badge variant="outline">Not connected</Badge>;
  if (status === "REAUTH_REQUIRED") return <Badge variant="destructive">Reconnect needed</Badge>;
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

export default function GoogleCalendarPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <GoogleCalendarPageContent />
    </Suspense>
  );
}
