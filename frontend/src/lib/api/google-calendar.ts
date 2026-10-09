import { apiRequest } from "./client";

import type { AppointmentCalendarSync, GoogleCalendarConnection, GoogleCalendarStatus } from "@/types";
import { query } from "./shared";
import type { Row } from "./shared";

// -------------------------------------------------------- google calendar
// One-way push into a physiotherapist's own Google Calendar. The clinic
// stays the source of truth; nothing is ever read back from Google.

export const getGoogleCalendarStatus = (staffId?: string): Promise<GoogleCalendarStatus> =>
  apiRequest<Row>(`/api/v1/integrations/google/status${query({ staffId })}`).then((row) => ({
    staffId: String(row.staffId),
    configured: Boolean(row.configured),
    connected: Boolean(row.connected),
    googleEmail: row.googleEmail == null ? null : String(row.googleEmail),
    connectedAt: row.connectedAt == null ? null : String(row.connectedAt),
    lastError: row.lastError == null ? null : String(row.lastError),
    lastErrorAt: row.lastErrorAt == null ? null : String(row.lastErrorAt),
    pending: Number(row.pending ?? 0),
  }));

export const listGoogleCalendarConnections = (): Promise<GoogleCalendarConnection[]> =>
  apiRequest<Row[]>("/api/v1/integrations/google/connections").then((rows) =>
    rows.map((row) => ({
      staffId: String(row.staff_id),
      staffName: row.staff_name == null ? "" : String(row.staff_name),
      position: row.position == null ? "" : String(row.position),
      googleEmail: row.google_email == null ? null : String(row.google_email),
      connectedAt: row.connected_at == null ? null : String(row.connected_at),
      lastError: row.last_error == null ? null : String(row.last_error),
      pending: Number(row.pending ?? 0),
    }))
  );

/** Returns the Google consent page to send the browser to. */
export const startGoogleCalendarConnect = () =>
  apiRequest<{ url: string }>("/api/v1/integrations/google/connect", { method: "POST" }).then((r) => r.url);

export const disconnectGoogleCalendar = (staffId?: string) =>
  apiRequest<void>(`/api/v1/integrations/google/connection${query({ staffId })}`, { method: "DELETE" });

export const getAppointmentCalendarSync = (appointmentId: string): Promise<AppointmentCalendarSync | null> =>
  apiRequest<Row | undefined>(`/api/v1/integrations/google/appointments/${appointmentId}`).then((row) =>
    row
      ? {
          status: String(row.sync_status) as AppointmentCalendarSync["status"],
          pendingAction: String(row.pending_action) as AppointmentCalendarSync["pendingAction"],
          attempts: Number(row.attempts ?? 0),
          lastError: row.last_error == null ? null : String(row.last_error),
          updatedAt: row.updated_at == null ? null : String(row.updated_at),
        }
      : null
  );

export const retryAppointmentCalendarSync = (appointmentId: string) =>
  apiRequest<void>(`/api/v1/integrations/google/appointments/${appointmentId}/retry`, { method: "POST" });
