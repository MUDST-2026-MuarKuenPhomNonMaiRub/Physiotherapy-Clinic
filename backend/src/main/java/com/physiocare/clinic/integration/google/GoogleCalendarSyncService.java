package com.physiocare.clinic.integration.google;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
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
  private static final DateTimeFormatter TIME = DateTimeFormatter.ofPattern("HH:mm");

  private final JdbcTemplate db;
  private final GoogleCalendarConnectionService connections;
  private final GoogleApiClient google;
  private final GoogleSettings settings;
  private final ExecutorService worker = Executors.newSingleThreadExecutor(r -> {
    Thread t = new Thread(r, "google-calendar-sync");
    t.setDaemon(true);
    return t;
  });

  public GoogleCalendarSyncService(
      JdbcTemplate db,
      GoogleCalendarConnectionService connections,
      GoogleApiClient google,
      GoogleSettings settings) {
    this.db = db;
    this.connections = connections;
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
    List<Map<String, Object>> rows =
        db.queryForList(
            "SELECT provider_staff_id,status FROM appointments WHERE id=?", appointmentId);
    if (rows.isEmpty()) return;
    long staffId = ((Number) rows.get(0).get("provider_staff_id")).longValue();
    String status = (String) rows.get(0).get("status");
    boolean live = LIVE_STATUSES.contains(status);

    boolean tracked =
        Boolean.TRUE.equals(
            db.queryForObject(
                "SELECT EXISTS(SELECT 1 FROM appointment_calendar_events WHERE appointment_id=?)",
                Boolean.class, appointmentId));
    // A cancelled appointment that never reached Google needs no row, and a
    // therapist with no connection gets none either — their backfill on
    // connect picks it up if it is still upcoming.
    if (!tracked && (!live || !connections.isConnected(staffId))) return;

    db.update(
        "INSERT INTO appointment_calendar_events(appointment_id,staff_id,pending_action,sync_status,"
            + "attempts,next_attempt_at,updated_at) VALUES(?,?,?,'PENDING',0,now(),now())"
            + " ON CONFLICT (appointment_id) DO UPDATE SET staff_id=EXCLUDED.staff_id,"
            + " pending_action=EXCLUDED.pending_action, sync_status='PENDING', attempts=0,"
            + " next_attempt_at=now(), updated_at=now()",
        appointmentId, staffId, live ? "UPSERT" : "DELETE");
    pushAfterCommit();
  }

  /** Everything still to come for a newly connected therapist. */
  @Transactional
  public int backfill(long staffId) {
    int queued =
        db.update(
            "INSERT INTO appointment_calendar_events(appointment_id,staff_id,pending_action,sync_status)"
                + " SELECT a.id,a.provider_staff_id,'UPSERT','PENDING' FROM appointments a WHERE"
                + " a.provider_staff_id=? AND a.status IN ('CONFIRMED','ARRIVED','IN_SERVICE','COMPLETED')"
                + " AND a.ends_at >= now() - interval '1 day'"
                + " ON CONFLICT (appointment_id) DO UPDATE SET pending_action='UPSERT',"
                + " sync_status='PENDING', attempts=0, next_attempt_at=now(), updated_at=now()",
            staffId);
    pushAfterCommit();
    return queued;
  }

  /** Puts a failed row back at the front of the queue. */
  @Transactional
  public void retry(long appointmentId) {
    db.update(
        "UPDATE appointment_calendar_events SET sync_status='PENDING', attempts=0, next_attempt_at=now(),"
            + " updated_at=now() WHERE appointment_id=? AND sync_status<>'DELETED'",
        appointmentId);
    pushAfterCommit();
  }

  /**
   * Removes every event the clinic wrote to this person's calendar, then
   * drops the connection. Done synchronously so a disconnect leaves nothing
   * behind; an event that cannot be reached is logged and skipped.
   */
  public void disconnect(long staffId, Long actorUserId, String reason) {
    Optional<GoogleCalendarConnectionService.Connection> connection = connections.connection(staffId);
    if (connection.isPresent()) {
      List<Long> ids =
          db.queryForList(
              "SELECT appointment_id FROM appointment_calendar_events WHERE staff_id=? AND"
                  + " google_event_id IS NOT NULL AND sync_status<>'DELETED'",
              Long.class, staffId);
      for (Long appointmentId : ids) {
        try {
          google.deleteEvent(
              connections.accessToken(connection.get()),
              connection.get().calendarId(),
              eventId(appointmentId));
        } catch (RuntimeException e) {
          log.warn("Could not remove Google event for appointment {} on disconnect: {}", appointmentId, e.getMessage());
        }
      }
    }
    db.update("DELETE FROM appointment_calendar_events WHERE staff_id=?", staffId);
    connections.disconnect(staffId, actorUserId, reason);
  }

  public Map<String, Object> syncStatus(long appointmentId) {
    return db.queryForList(
            "SELECT sync_status,pending_action,attempts,last_error,updated_at FROM"
                + " appointment_calendar_events WHERE appointment_id=?",
            appointmentId)
        .stream()
        .findFirst()
        .orElse(null);
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
      List<Map<String, Object>> due =
          db.queryForList(
              "SELECT appointment_id,staff_id,pending_action,google_event_id,attempts FROM"
                  + " appointment_calendar_events WHERE sync_status IN ('PENDING','FAILED') AND"
                  + " next_attempt_at<=now() ORDER BY next_attempt_at LIMIT ?",
              MAX_BATCH);
      for (Map<String, Object> row : due) push(row);
    } catch (RuntimeException e) {
      log.error("Google Calendar sync sweep failed", e);
    }
  }

  private void push(Map<String, Object> row) {
    long appointmentId = ((Number) row.get("appointment_id")).longValue();
    long staffId = ((Number) row.get("staff_id")).longValue();
    String action = (String) row.get("pending_action");
    int attempts = ((Number) row.get("attempts")).intValue();

    Optional<GoogleCalendarConnectionService.Connection> connection = connections.connection(staffId);
    if (connection.isEmpty()) {
      // Disconnected while queued: nothing to push, nothing to keep.
      db.update("DELETE FROM appointment_calendar_events WHERE appointment_id=?", appointmentId);
      return;
    }
    try {
      String token = connections.accessToken(connection.get());
      String calendar = connection.get().calendarId();
      String eventId = eventId(appointmentId);
      if ("DELETE".equals(action)) {
        google.deleteEvent(token, calendar, eventId);
        db.update(
            "UPDATE appointment_calendar_events SET sync_status='DELETED', last_error=NULL,"
                + " updated_at=now() WHERE appointment_id=?",
            appointmentId);
      } else {
        Map<String, Object> event = buildEvent(appointmentId);
        if (event == null) {
          db.update("DELETE FROM appointment_calendar_events WHERE appointment_id=?", appointmentId);
          return;
        }
        try {
          google.insertEvent(token, calendar, event);
        } catch (GoogleApiClient.GoogleApiException e) {
          if (e.status() != 409) throw e;
          // Already there from an earlier push whose answer was lost, or a
          // resend after an edit: bring it up to date instead.
          google.updateEvent(token, calendar, eventId, event);
        }
        db.update(
            "UPDATE appointment_calendar_events SET sync_status='SYNCED', google_event_id=?,"
                + " last_error=NULL, attempts=0, updated_at=now() WHERE appointment_id=?",
            eventId, appointmentId);
      }
      connections.clearError(staffId);
    } catch (GoogleApiClient.GoogleApiException e) {
      if (e.unauthorised()) connections.forgetAccessToken(staffId);
      fail(appointmentId, staffId, attempts, e.getMessage(), e.permanent());
    } catch (RuntimeException e) {
      log.warn("Google Calendar push failed for appointment {}", appointmentId, e);
      fail(appointmentId, staffId, attempts, e.getMessage() == null ? e.toString() : e.getMessage(), false);
    }
  }

  private void fail(long appointmentId, long staffId, int attempts, String message, boolean permanent) {
    // 1, 2, 4 … 64 minutes between tries, capped; a permanent rejection
    // still stays visible as FAILED so it can be retried by hand after the
    // cause (a revoked grant, say) is fixed.
    long minutes = Math.min(64, 1L << Math.min(attempts, 6));
    db.update(
        "UPDATE appointment_calendar_events SET sync_status='FAILED', attempts=attempts+1, last_error=?,"
            + " next_attempt_at=now() + (? * interval '1 minute'), updated_at=now() WHERE appointment_id=?",
        message, permanent ? 60L * 24 : minutes, appointmentId);
    connections.recordError(staffId, message);
  }

  // -------------------------------------------------------------- event

  /**
   * A deterministic Google event id per appointment (base32hex: a-v, 0-9),
   * so a retried insert lands on the same event instead of a duplicate.
   */
  static String eventId(long appointmentId) {
    return "labalance" + appointmentId;
  }

  /**
   * What the therapist sees in Google: who (nickname, else HN — never the
   * full name or phone, since this lives in their personal account), what,
   * where, and a link back into the system for everything else. Null when
   * the appointment no longer exists.
   */
  Map<String, Object> buildEvent(long appointmentId) {
    List<Map<String, Object>> rows =
        db.queryForList(
            "SELECT a.id,a.status,a.starts_at,a.ends_at,a.appointment_no,"
                + " p.hn,p.nickname,s.name_th AS service_name,r.name AS room_name,b.name AS branch_name,"
                + " b.address AS branch_address, b.timezone"
                + " FROM appointments a JOIN patients p ON p.id=a.patient_id"
                + " JOIN services s ON s.id=a.service_id JOIN branches b ON b.id=a.branch_id"
                + " LEFT JOIN rooms r ON r.id=a.room_id WHERE a.id=?",
            appointmentId);
    if (rows.isEmpty()) return null;
    Map<String, Object> a = rows.get(0);
    String zone = a.get("timezone") == null ? "Asia/Bangkok" : (String) a.get("timezone");
    OffsetDateTime starts = toOffset(a.get("starts_at"), zone);
    OffsetDateTime ends = toOffset(a.get("ends_at"), zone);
    String status = (String) a.get("status");
    String who =
        a.get("nickname") != null && !((String) a.get("nickname")).isBlank()
            ? (String) a.get("nickname")
            : "HN " + a.get("hn");
    String summary = ("COMPLETED".equals(status) ? "✓ " : "") + who + " · " + a.get("service_name");

    StringBuilder description = new StringBuilder();
    description.append("HN ").append(a.get("hn")).append('\n');
    description.append("Service: ").append(a.get("service_name")).append('\n');
    if (a.get("room_name") != null) description.append("Room: ").append(a.get("room_name")).append('\n');
    description.append("Branch: ").append(a.get("branch_name")).append('\n');
    description.append("Time: ").append(TIME.format(starts)).append('–').append(TIME.format(ends)).append('\n');
    description.append("Status: ").append(status).append('\n');
    description.append("Appointment ").append(a.get("appointment_no")).append('\n');
    description.append('\n').append("Open in LA BALANCE: ")
        .append(settings.frontendUrl()).append("/appointments/").append(appointmentId);

    Map<String, Object> event = new LinkedHashMap<>();
    event.put("id", eventId(appointmentId));
    event.put("summary", summary);
    event.put("description", description.toString());
    if (a.get("branch_address") != null) event.put("location", a.get("branch_address"));
    event.put("start", Map.of("dateTime", starts.toString(), "timeZone", zone));
    event.put("end", Map.of("dateTime", ends.toString(), "timeZone", zone));
    event.put("reminders", Map.of("useDefault", true));
    event.put(
        "extendedProperties",
        Map.of("private", Map.of("labalanceAppointmentId", String.valueOf(appointmentId), "source", "LA BALANCE")));
    return event;
  }

  private static OffsetDateTime toOffset(Object value, String zone) {
    Instant instant;
    if (value instanceof java.sql.Timestamp t) instant = t.toInstant();
    else if (value instanceof OffsetDateTime o) instant = o.toInstant();
    else throw new IllegalStateException("Unexpected timestamp type " + value);
    return instant.atZone(ZoneId.of(zone)).toOffsetDateTime();
  }
}
