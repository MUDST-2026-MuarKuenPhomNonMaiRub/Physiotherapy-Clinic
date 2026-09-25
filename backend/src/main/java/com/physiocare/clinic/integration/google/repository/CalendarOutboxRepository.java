package com.physiocare.clinic.integration.google.repository;

import com.physiocare.clinic.integration.google.model.CalendarOutboxEntry;
import com.physiocare.clinic.integration.google.model.GoogleCalendarDtos.SyncStatusResponse;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/**
 * appointment_calendar_events: one row per appointment that has (or should
 * have) an event in Google. The worker drains PENDING and due FAILED rows.
 */
@Repository
public class CalendarOutboxRepository {
  private final JdbcTemplate db;

  public CalendarOutboxRepository(JdbcTemplate db) {
    this.db = db;
  }

  public boolean isTracked(long appointmentId) {
    return Boolean.TRUE.equals(
        db.queryForObject(
            "SELECT EXISTS(SELECT 1 FROM appointment_calendar_events WHERE appointment_id=?)",
            Boolean.class, appointmentId));
  }

  /** Queues a push for the appointment, replacing whatever was queued before. */
  public void queue(long appointmentId, long staffId, String action) {
    db.update(
        "INSERT INTO appointment_calendar_events(appointment_id,staff_id,pending_action,sync_status,"
            + "attempts,next_attempt_at,updated_at) VALUES(?,?,?,'PENDING',0,now(),now())"
            + " ON CONFLICT (appointment_id) DO UPDATE SET staff_id=EXCLUDED.staff_id,"
            + " pending_action=EXCLUDED.pending_action, sync_status='PENDING', attempts=0,"
            + " next_attempt_at=now(), updated_at=now()",
        appointmentId, staffId, action);
  }

  /** Queues every appointment still to come (or from the last day) for a newly connected therapist. */
  public int queueUpcoming(long staffId) {
    return db.update(
        "INSERT INTO appointment_calendar_events(appointment_id,staff_id,pending_action,sync_status)"
            + " SELECT a.id,a.provider_staff_id,'UPSERT','PENDING' FROM appointments a WHERE"
            + " a.provider_staff_id=? AND a.status IN ('CONFIRMED','ARRIVED','IN_SERVICE','COMPLETED')"
            + " AND a.ends_at >= now() - interval '1 day'"
            + " ON CONFLICT (appointment_id) DO UPDATE SET pending_action='UPSERT',"
            + " sync_status='PENDING', attempts=0, next_attempt_at=now(), updated_at=now()",
        staffId);
  }

  public void requeue(long appointmentId) {
    db.update(
        "UPDATE appointment_calendar_events SET sync_status='PENDING', attempts=0, next_attempt_at=now(),"
            + " updated_at=now() WHERE appointment_id=? AND sync_status<>'DELETED'",
        appointmentId);
  }

  public List<CalendarOutboxEntry> findDue(int limit) {
    return db.query(
        "SELECT appointment_id,staff_id,pending_action,google_event_id,attempts FROM"
            + " appointment_calendar_events WHERE sync_status IN ('PENDING','FAILED') AND"
            + " next_attempt_at<=now() ORDER BY next_attempt_at LIMIT ?",
        (rs, i) -> new CalendarOutboxEntry(
            rs.getLong("appointment_id"),
            rs.getLong("staff_id"),
            rs.getString("pending_action"),
            rs.getString("google_event_id"),
            rs.getInt("attempts")),
        limit);
  }

  /** Appointments whose event is still in this therapist's calendar. */
  public List<Long> findPlacedAppointmentIds(long staffId) {
    return db.queryForList(
        "SELECT appointment_id FROM appointment_calendar_events WHERE staff_id=? AND"
            + " google_event_id IS NOT NULL AND sync_status<>'DELETED'",
        Long.class, staffId);
  }

  public void markSynced(long appointmentId, String eventId) {
    db.update(
        "UPDATE appointment_calendar_events SET sync_status='SYNCED', google_event_id=?,"
            + " last_error=NULL, attempts=0, updated_at=now() WHERE appointment_id=?",
        eventId, appointmentId);
  }

  public void markDeleted(long appointmentId) {
    db.update(
        "UPDATE appointment_calendar_events SET sync_status='DELETED', last_error=NULL,"
            + " updated_at=now() WHERE appointment_id=?",
        appointmentId);
  }

  /** Records a failed attempt and when the next one is due. */
  public void markFailed(long appointmentId, String message, long retryInMinutes) {
    db.update(
        "UPDATE appointment_calendar_events SET sync_status='FAILED', attempts=attempts+1, last_error=?,"
            + " next_attempt_at=now() + (? * interval '1 minute'), updated_at=now() WHERE appointment_id=?",
        message, retryInMinutes, appointmentId);
  }

  public void deleteForAppointment(long appointmentId) {
    db.update("DELETE FROM appointment_calendar_events WHERE appointment_id=?", appointmentId);
  }

  public void deleteForStaff(long staffId) {
    db.update("DELETE FROM appointment_calendar_events WHERE staff_id=?", staffId);
  }

  public Optional<SyncStatusResponse> findStatus(long appointmentId) {
    return db.query(
            "SELECT sync_status,pending_action,attempts,last_error,updated_at FROM"
                + " appointment_calendar_events WHERE appointment_id=?",
            (rs, i) -> new SyncStatusResponse(
                rs.getString("sync_status"),
                rs.getString("pending_action"),
                rs.getInt("attempts"),
                rs.getString("last_error"),
                rs.getObject("updated_at", OffsetDateTime.class)),
            appointmentId)
        .stream()
        .findFirst();
  }

  public int countOutstanding(long staffId) {
    Integer count =
        db.queryForObject(
            "SELECT count(*) FROM appointment_calendar_events WHERE staff_id=? AND sync_status IN"
                + " ('PENDING','FAILED')",
            Integer.class, staffId);
    return count == null ? 0 : count;
  }
}
