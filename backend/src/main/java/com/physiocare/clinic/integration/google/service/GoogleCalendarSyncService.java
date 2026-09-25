package com.physiocare.clinic.integration.google.service;

import com.physiocare.clinic.integration.google.client.GoogleApiClient;
import com.physiocare.clinic.integration.google.client.GoogleApiException;
import com.physiocare.clinic.integration.google.config.GoogleSettings;
import com.physiocare.clinic.integration.google.model.AppointmentSchedule;
import com.physiocare.clinic.integration.google.model.CalendarConnection;
import com.physiocare.clinic.integration.google.model.CalendarOutboxEntry;
import com.physiocare.clinic.integration.google.model.GoogleCalendarDtos.SyncStatusResponse;
import com.physiocare.clinic.integration.google.repository.AppointmentCalendarRepository;
import com.physiocare.clinic.integration.google.repository.CalendarOutboxRepository;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/**
 * Pushes appointments into the treating physiotherapist's Google Calendar.
 *
 * <p>Nothing here runs inside the booking transaction: a change queues a row
 * in {@code appointment_calendar_events} and the push happens after commit,
 * on a worker thread, with retries — so Google being slow or down never
 * stops the counter. The clinic system is the only source of truth: events
 * are written, never read, and one edited in Google is overwritten by the
 * next push.
 */
@Service
public class GoogleCalendarSyncService {
  private static final Logger log = LoggerFactory.getLogger(GoogleCalendarSyncService.class);
  /** Statuses that keep an event on the calendar; anything else removes it. */
  static final Set<String> LIVE_STATUSES = Set.of("CONFIRMED", "ARRIVED", "IN_SERVICE", "COMPLETED");
  private static final int MAX_BATCH = 50;
  /** A request Google will never accept waits a day before it is tried again. */
  private static final long PERMANENT_FAILURE_MINUTES = 60L * 24;

  private final CalendarOutboxRepository outbox;
  private final AppointmentCalendarRepository appointments;
  private final GoogleCalendarConnectionService connections;
  private final CalendarEventFactory events;
  private final GoogleApiClient google;
  private final GoogleSettings settings;
  private final ExecutorService worker = Executors.newSingleThreadExecutor(r -> {
    Thread t = new Thread(r, "google-calendar-sync");
    t.setDaemon(true);
    return t;
  });

  public GoogleCalendarSyncService(
      CalendarOutboxRepository outbox,
      AppointmentCalendarRepository appointments,
      GoogleCalendarConnectionService connections,
      CalendarEventFactory events,
      GoogleApiClient google,
      GoogleSettings settings) {
    this.outbox = outbox;
    this.appointments = appointments;
    this.connections = connections;
    this.events = events;
    this.google = google;
    this.settings = settings;
  }

  // ------------------------------------------------------------ queueing

  /**
   * Called on every appointment change. Reads the appointment's current
   * status to decide whether the event should exist, and queues the push to
   * run once the caller's transaction has committed.
   */
  @Transactional
  public void appointmentChanged(long appointmentId) {
    Optional<AppointmentSchedule> schedule = appointments.findSchedule(appointmentId);
    if (schedule.isEmpty()) return;
    long staffId = schedule.get().providerStaffId();
    boolean live = LIVE_STATUSES.contains(schedule.get().status());

    // A cancelled appointment that never reached Google needs no row, and a
    // therapist with no connection gets none either — their backfill on
    // connect picks it up if it is still upcoming.
    if (!outbox.isTracked(appointmentId) && (!live || !connections.isConnected(staffId))) return;

    outbox.queue(appointmentId, staffId, live ? "UPSERT" : "DELETE");
    pushAfterCommit();
  }

  /** Everything still to come for a newly connected therapist. */
  @Transactional
  public int backfill(long staffId) {
    int queued = outbox.queueUpcoming(staffId);
    pushAfterCommit();
    return queued;
  }

  /** Puts a failed row back at the front of the queue. */
  @Transactional
  public void retry(long appointmentId) {
    outbox.requeue(appointmentId);
    pushAfterCommit();
  }

  /**
   * Removes every event the clinic wrote to this person's calendar, then
   * drops the connection. Done synchronously so a disconnect leaves nothing
   * behind; an event that cannot be reached is logged and skipped.
   */
  public void disconnect(long staffId, Long actorUserId, String reason) {
    Optional<CalendarConnection> connection = connections.connection(staffId);
    if (connection.isPresent()) {
      for (Long appointmentId : outbox.findPlacedAppointmentIds(staffId)) {
        try {
          google.deleteEvent(
              connections.accessToken(connection.get()),
              connection.get().calendarId(),
              CalendarEventFactory.eventId(appointmentId));
        } catch (RuntimeException e) {
          log.warn("Could not remove Google event for appointment {} on disconnect: {}", appointmentId, e.getMessage());
        }
      }
    }
    outbox.deleteForStaff(staffId);
    connections.disconnect(staffId, actorUserId, reason);
  }

  public Optional<SyncStatusResponse> syncStatus(long appointmentId) {
    return outbox.findStatus(appointmentId);
  }

  public int outstanding(long staffId) {
    return outbox.countOutstanding(staffId);
  }

  // ------------------------------------------------------------- worker

  private void pushAfterCommit() {
    if (TransactionSynchronizationManager.isSynchronizationActive()) {
      TransactionSynchronizationManager.registerSynchronization(
          new TransactionSynchronization() {
            @Override
            public void afterCommit() {
              worker.submit(GoogleCalendarSyncService.this::processDue);
            }
          });
    } else {
      worker.submit(this::processDue);
    }
  }

  /** Safety net for anything the after-commit push missed (a restart, a back-off that has elapsed). */
  @Scheduled(fixedDelayString = "${app.google.sync-interval-ms:60000}", initialDelay = 15000)
  public void scheduledSweep() {
    if (!settings.configured()) return;
    worker.submit(this::processDue);
  }

  void processDue() {
    try {
      for (CalendarOutboxEntry row : outbox.findDue(MAX_BATCH)) push(row);
    } catch (RuntimeException e) {
      log.error("Google Calendar sync sweep failed", e);
    }
  }

  private void push(CalendarOutboxEntry row) {
    long appointmentId = row.appointmentId();
    Optional<CalendarConnection> connection = connections.connection(row.staffId());
    if (connection.isEmpty()) {
      // Disconnected while queued: nothing to push, nothing to keep.
      outbox.deleteForAppointment(appointmentId);
      return;
    }
    try {
      String token = connections.accessToken(connection.get());
      String calendar = connection.get().calendarId();
      String eventId = CalendarEventFactory.eventId(appointmentId);
      if (row.isDelete()) {
        google.deleteEvent(token, calendar, eventId);
        outbox.markDeleted(appointmentId);
      } else {
        Optional<Map<String, Object>> event = appointments.findEventSource(appointmentId).map(events::build);
        if (event.isEmpty()) {
          outbox.deleteForAppointment(appointmentId);
          return;
        }
        try {
          google.insertEvent(token, calendar, event.get());
        } catch (GoogleApiException e) {
          if (e.status() != 409) throw e;
          // Already there from an earlier push whose answer was lost, or a
          // resend after an edit: bring it up to date instead.
          google.updateEvent(token, calendar, eventId, event.get());
        }
        outbox.markSynced(appointmentId, eventId);
      }
      connections.clearError(row.staffId());
    } catch (GoogleApiException e) {
      if (e.unauthorised()) connections.forgetAccessToken(row.staffId());
      fail(row, e.getMessage(), e.permanent());
    } catch (RuntimeException e) {
      log.warn("Google Calendar push failed for appointment {}", appointmentId, e);
      fail(row, e.getMessage() == null ? e.toString() : e.getMessage(), false);
    }
  }

  /**
   * 1, 2, 4 … 64 minutes between tries, capped; a permanent rejection (a
   * revoked grant, a wrong client key) waits a day but stays visible as
   * FAILED so it can be retried by hand once the cause is fixed.
   */
  private void fail(CalendarOutboxEntry row, String message, boolean permanent) {
    long minutes = permanent ? PERMANENT_FAILURE_MINUTES : Math.min(64, 1L << Math.min(row.attempts(), 6));
    outbox.markFailed(row.appointmentId(), message, minutes);
    connections.recordError(row.staffId(), message);
  }
}
