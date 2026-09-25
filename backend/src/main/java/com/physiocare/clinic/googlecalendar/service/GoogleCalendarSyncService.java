package com.physiocare.clinic.googlecalendar.service;

import com.physiocare.clinic.appointment.AppointmentChangedEvent;
import com.physiocare.clinic.common.BranchAccessService;
import com.physiocare.clinic.googlecalendar.client.GoogleApiException;
import com.physiocare.clinic.googlecalendar.client.GoogleCalendarApiClient;
import com.physiocare.clinic.googlecalendar.config.GoogleCalendarProperties;
import com.physiocare.clinic.googlecalendar.model.AppointmentSyncSnapshot;
import com.physiocare.clinic.googlecalendar.model.CalendarEvent;
import com.physiocare.clinic.googlecalendar.model.GoogleCalendarConnection;
import com.physiocare.clinic.googlecalendar.model.GoogleCalendarDtos.SyncResultResponse;
import com.physiocare.clinic.googlecalendar.model.GoogleSyncStatus;
import com.physiocare.clinic.googlecalendar.repository.AppointmentSyncRepository;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

/**
 * Keeps each appointment's event in its physiotherapist's Google Calendar in
 * step with the booking.
 *
 * <p>The work is split in two. {@link #prepare} runs inside the booking
 * transaction and only writes sync state to the database, so it commits or
 * rolls back with the booking. {@link #sync} runs after commit, on a background
 * thread, and is the only part that calls Google — a slow or failing Google
 * can therefore never stop an appointment from being booked. Anything that
 * fails stays FAILED and is retried by the scheduled job.
 */
@Service
public class GoogleCalendarSyncService {
  private static final Logger log = LoggerFactory.getLogger(GoogleCalendarSyncService.class);
  static final String NOT_CONNECTED = "The physiotherapist has not connected Google Calendar";
  static final String CANCELLED_BEFORE_SYNC = "Cancelled before it reached Google Calendar";
  private static final int UPCOMING_LIMIT = 500;
  private static final int RETRY_BATCH = 50;

  /** One lock per appointment (striped), so the listener and the retry job never race on a row. */
  private final Object[] locks = new Object[64];

  private final GoogleCalendarProperties properties;
  private final AppointmentSyncRepository appointments;
  private final GoogleCalendarConnectionService connections;
  private final GoogleCalendarApiClient calendar;
  private final CalendarEventFactory eventFactory;
  private final BranchAccessService branches;

  public GoogleCalendarSyncService(GoogleCalendarProperties properties,
      AppointmentSyncRepository appointments, GoogleCalendarConnectionService connections,
      GoogleCalendarApiClient calendar, CalendarEventFactory eventFactory,
      BranchAccessService branches) {
    this.properties = properties;
    this.appointments = appointments;
    this.connections = connections;
    this.calendar = calendar;
    this.eventFactory = eventFactory;
    this.branches = branches;
    for (int i = 0; i < locks.length; i++) locks[i] = new Object();
  }

  /** Records what needs doing, inside the booking transaction. Never calls Google. */
  public void prepare(AppointmentChangedEvent event) {
    if (!properties.isConfigured()) return;
    switch (event.type()) {
      case CREATED -> queue(event.appointmentId());
      case RESCHEDULED -> {
        appointments.transferEvent(event.previousAppointmentId(), event.appointmentId());
        queue(event.appointmentId());
      }
      case STATUS_CHANGED -> appointments.findSnapshot(event.appointmentId())
          .filter(AppointmentSyncSnapshot::isCancelled)
          .ifPresent(a -> {
            if (a.googleEventId() != null) appointments.markPending(a.appointmentId(), false);
            else if (a.needsSync()) appointments.markSkipped(a.appointmentId(), CANCELLED_BEFORE_SYNC);
          });
    }
  }

  /** Brings one appointment's event up to date. Safe to call repeatedly. */
  public void sync(long appointmentId) {
    if (!properties.isConfigured()) return;
    synchronized (locks[(int) Math.floorMod(appointmentId, (long) locks.length)]) {
      AppointmentSyncSnapshot a = appointments.findSnapshot(appointmentId).orElse(null);
      if (a == null || !a.needsSync()) return;
      if (a.isRescheduled()) {
        appointments.markMoved(appointmentId);
        return;
      }
      GoogleCalendarConnection connection = connections.findConnection(a.providerStaffId()).orElse(null);
      if (connection == null) {
        appointments.markSkipped(appointmentId, NOT_CONNECTED);
        return;
      }
      if (!connection.isActive()) {
        appointments.markFailed(appointmentId, GoogleCalendarConnectionService.REAUTH_MESSAGE);
        return;
      }
      if (a.isCancelled() && a.googleEventId() == null) {
        appointments.markSkipped(appointmentId, CANCELLED_BEFORE_SYNC);
        return;
      }

      appointments.recordAttempt(appointmentId);
      try {
        String token = connections.accessTokenFor(connection);
        if (a.isCancelled()) removeEvent(token, connection, a);
        else upsertEvent(token, connection, a);
      } catch (GoogleApiException e) {
        if (e.isAuthFailure()) {
          connections.markReauthRequired(connection.staffId());
          appointments.markFailed(appointmentId, GoogleCalendarConnectionService.REAUTH_MESSAGE);
        } else if (e.isClientMisconfigured()) {
          appointments.markFailed(appointmentId,
              "Google rejected the clinic's OAuth client. Check GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET.");
        } else {
          appointments.markFailed(appointmentId, "Google Calendar: " + e.getMessage());
        }
        log.warn("Google Calendar sync failed for appointment {}: {} {}", appointmentId, e.status(), e.getMessage());
      } catch (RuntimeException e) {
        appointments.markFailed(appointmentId, "Unexpected error while syncing");
        log.error("Google Calendar sync failed for appointment {}", appointmentId, e);
      }
    }
  }

  /** Manual "sync again" from the appointment screen; runs straight away and reports the outcome. */
  public SyncResultResponse retry(long appointmentId, Authentication auth) {
    if (!properties.isConfigured()) {
      throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
          "Google Calendar sync is not configured on this server");
    }
    AppointmentSyncSnapshot a = appointments.findSnapshot(appointmentId)
        .orElseThrow(() -> new IllegalArgumentException("Appointment not found"));
    branches.requireAccess(auth, appointments.branchIdOf(appointmentId));
    boolean settled = a.syncStatus() == GoogleSyncStatus.REMOVED || a.syncStatus() == GoogleSyncStatus.MOVED;
    if (!settled) {
      appointments.markPending(appointmentId, true);
      sync(appointmentId);
    }
    return appointments.findSyncResult(appointmentId);
  }

  /** After someone connects, copies their upcoming bookings into the new calendar. */
  public void syncUpcomingFor(long staffId) {
    if (!properties.isConfigured()) return;
    appointments.queueUpcomingForProvider(staffId, UPCOMING_LIMIT).forEach(this::sync);
  }

  /** One pass of the retry job. */
  public void retryDue() {
    if (!properties.isConfigured()) return;
    appointments.findRetryable(properties.maxAttempts(), RETRY_BATCH).forEach(this::sync);
  }

  private void queue(long appointmentId) {
    appointments.findSnapshot(appointmentId).ifPresent(a -> {
      if (connections.findConnection(a.providerStaffId()).isPresent()) {
        appointments.markPending(appointmentId, false);
      } else {
        appointments.markSkipped(appointmentId, NOT_CONNECTED);
      }
    });
  }

  /**
   * Updates the existing event when there is one, otherwise creates it. The
   * new event id is saved before the insert is sent, so if Google's reply is
   * lost the next attempt patches that event instead of creating a duplicate.
   */
  private void upsertEvent(String token, GoogleCalendarConnection connection, AppointmentSyncSnapshot a) {
    CalendarEvent event = eventFactory.build(a);
    if (a.googleEventId() != null) {
      try {
        calendar.patchEvent(token, connection.calendarId(), a.googleEventId(), event);
        appointments.markSynced(a.appointmentId(), a.googleEventId());
        return;
      } catch (GoogleApiException e) {
        if (!e.isNotFound()) throw e;
        // The event never got created, or was purged in Google: make a new one.
      }
    }
    String eventId = newEventId();
    appointments.assignEventId(a.appointmentId(), eventId);
    try {
      calendar.insertEvent(token, connection.calendarId(), eventId, event);
    } catch (GoogleApiException e) {
      if (!e.isConflict()) throw e;
      calendar.patchEvent(token, connection.calendarId(), eventId, event);
    }
    appointments.markSynced(a.appointmentId(), eventId);
  }

  private void removeEvent(String token, GoogleCalendarConnection connection, AppointmentSyncSnapshot a) {
    try {
      calendar.deleteEvent(token, connection.calendarId(), a.googleEventId());
    } catch (GoogleApiException e) {
      if (!e.isNotFound()) throw e;
      // Already gone — someone deleted it in Google. Nothing left to do.
    }
    appointments.markRemoved(a.appointmentId());
  }

  /** Google event ids allow the characters 0-9 and a-v; a hex UUID uses a subset of those. */
  static String newEventId() {
    return "pc" + UUID.randomUUID().toString().replace("-", "");
  }
}
