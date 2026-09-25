package com.physiocare.clinic.googlecalendar.repository;

import com.physiocare.clinic.googlecalendar.model.AppointmentSyncSnapshot;
import com.physiocare.clinic.googlecalendar.model.GoogleCalendarDtos.SyncResultResponse;
import com.physiocare.clinic.googlecalendar.model.GoogleSyncStatus;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Reads and writes the google_* sync columns on appointments. */
@Repository
public class AppointmentSyncRepository {
  /** Statuses that still hold a slot in the provider's day. */
  private static final String ACTIVE_STATUSES = "('CONFIRMED','ARRIVED','IN_SERVICE')";

  private final JdbcTemplate db;

  public AppointmentSyncRepository(JdbcTemplate db) {
    this.db = db;
  }

  public Optional<AppointmentSyncSnapshot> findSnapshot(long appointmentId) {
    return db.query(
            "SELECT a.id,a.appointment_no,a.status,a.provider_staff_id,a.starts_at,a.ends_at,"
                + "a.google_event_id,a.google_sync_status,p.hn,"
                + "COALESCE(NULLIF(trim(p.nickname),''),p.first_name_th) AS patient_short_name,"
                + "COALESCE(NULLIF(trim(s.name_th),''),s.name_en) AS service_name,"
                + "b.name AS branch_name,r.name AS room_name"
                + " FROM appointments a JOIN patients p ON p.id=a.patient_id"
                + " JOIN services s ON s.id=a.service_id JOIN branches b ON b.id=a.branch_id"
                + " LEFT JOIN rooms r ON r.id=a.room_id WHERE a.id=?",
            this::mapSnapshot,
            appointmentId)
        .stream()
        .findFirst();
  }

  public SyncResultResponse findSyncResult(long appointmentId) {
    return db.queryForObject(
        "SELECT id,google_sync_status,google_synced_at,google_sync_error FROM appointments WHERE id=?",
        (rs, i) -> new SyncResultResponse(
            rs.getLong("id"),
            rs.getString("google_sync_status"),
            rs.getObject("google_synced_at", OffsetDateTime.class),
            rs.getString("google_sync_error")),
        appointmentId);
  }

  public long branchIdOf(long appointmentId) {
    return db.queryForObject(
        "SELECT branch_id FROM appointments WHERE id=?", Long.class, appointmentId);
  }

  /** Queues the appointment for sync; a manual retry also resets the attempt counter. */
  public void markPending(long appointmentId, boolean resetAttempts) {
    db.update(
        "UPDATE appointments SET google_sync_status='PENDING',google_sync_error=NULL,"
            + "google_sync_attempts=CASE WHEN ? THEN 0 ELSE google_sync_attempts END WHERE id=?",
        resetAttempts, appointmentId);
  }

  public void markSkipped(long appointmentId, String reason) {
    setStatus(appointmentId, GoogleSyncStatus.SKIPPED, reason);
  }

  public void markFailed(long appointmentId, String error) {
    setStatus(appointmentId, GoogleSyncStatus.FAILED, error);
  }

  public void markMoved(long appointmentId) {
    setStatus(appointmentId, GoogleSyncStatus.MOVED, null);
  }

  public void markSynced(long appointmentId, String eventId) {
    db.update(
        "UPDATE appointments SET google_sync_status='SYNCED',google_event_id=?,"
            + "google_synced_at=now(),google_sync_error=NULL,google_sync_attempts=0 WHERE id=?",
        eventId, appointmentId);
  }

  public void markRemoved(long appointmentId) {
    db.update(
        "UPDATE appointments SET google_sync_status='REMOVED',google_event_id=NULL,"
            + "google_synced_at=now(),google_sync_error=NULL,google_sync_attempts=0 WHERE id=?",
        appointmentId);
  }

  /**
   * Stores the event id before the insert is sent, so a retry after a lost
   * reply updates that same event rather than creating a second one.
   */
  public void assignEventId(long appointmentId, String eventId) {
    db.update("UPDATE appointments SET google_event_id=? WHERE id=?", eventId, appointmentId);
  }

  public void recordAttempt(long appointmentId) {
    db.update(
        "UPDATE appointments SET google_sync_attempts=google_sync_attempts+1,"
            + "google_sync_attempted_at=now() WHERE id=?",
        appointmentId);
  }

  /**
   * Hands the calendar event from a rescheduled booking to its replacement, so
   * the event is moved rather than deleted and created again.
   *
   * @return true when there was an event to hand over
   */
  public boolean transferEvent(long fromAppointmentId, long toAppointmentId) {
    int moved = db.update(
        "UPDATE appointments target SET google_event_id=source.google_event_id"
            + " FROM appointments source WHERE source.id=? AND target.id=?"
            + " AND source.google_event_id IS NOT NULL",
        fromAppointmentId, toAppointmentId);
    if (moved == 0) return false;
    db.update(
        "UPDATE appointments SET google_event_id=NULL,google_sync_status='MOVED',"
            + "google_sync_error=NULL WHERE id=?",
        fromAppointmentId);
    return true;
  }

  /**
   * Rows the retry job should pick up: waiting or failed, not tried in the last
   * two minutes, under the attempt limit, and only for providers whose Google
   * link still works.
   */
  public List<Long> findRetryable(int maxAttempts, int limit) {
    return db.queryForList(
        "SELECT a.id FROM appointments a JOIN google_calendar_connections c"
            + " ON c.staff_id=a.provider_staff_id AND c.status='ACTIVE'"
            + " WHERE a.google_sync_status IN ('PENDING','FAILED') AND a.google_sync_attempts<?"
            + " AND (a.google_sync_attempted_at IS NULL OR"
            + " a.google_sync_attempted_at < now() - interval '2 minutes')"
            + " AND a.ends_at > now() - interval '1 day' ORDER BY a.starts_at LIMIT ?",
        Long.class, maxAttempts, limit);
  }

  /**
   * Queues a provider's upcoming bookings that never reached Google — used
   * right after they connect, so the calendar is complete from day one.
   */
  public List<Long> queueUpcomingForProvider(long staffId, int limit) {
    return db.queryForList(
        "UPDATE appointments SET google_sync_status='PENDING',google_sync_error=NULL,"
            + "google_sync_attempts=0 WHERE id IN (SELECT id FROM appointments"
            + " WHERE provider_staff_id=? AND status IN " + ACTIVE_STATUSES
            + " AND starts_at > now() AND (google_sync_status IS NULL OR"
            + " google_sync_status IN ('SKIPPED','FAILED','PENDING'))"
            + " ORDER BY starts_at LIMIT ?) RETURNING id",
        Long.class, staffId, limit);
  }

  private void setStatus(long appointmentId, GoogleSyncStatus status, String error) {
    db.update(
        "UPDATE appointments SET google_sync_status=?,google_sync_error=? WHERE id=?",
        status.name(), truncate(error), appointmentId);
  }

  private static String truncate(String value) {
    return value == null || value.length() <= 500 ? value : value.substring(0, 500);
  }

  private AppointmentSyncSnapshot mapSnapshot(ResultSet rs, int row) throws SQLException {
    String syncStatus = rs.getString("google_sync_status");
    return new AppointmentSyncSnapshot(
        rs.getLong("id"),
        rs.getString("appointment_no"),
        rs.getString("status"),
        rs.getLong("provider_staff_id"),
        rs.getObject("starts_at", OffsetDateTime.class),
        rs.getObject("ends_at", OffsetDateTime.class),
        rs.getString("hn"),
        rs.getString("patient_short_name"),
        rs.getString("service_name"),
        rs.getString("branch_name"),
        rs.getString("room_name"),
        rs.getString("google_event_id"),
        syncStatus == null ? null : GoogleSyncStatus.valueOf(syncStatus));
  }
}
