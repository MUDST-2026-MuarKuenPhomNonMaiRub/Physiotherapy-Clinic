package com.physiocare.clinic.integration.google.repository;

import com.physiocare.clinic.integration.google.model.GoogleCalendarDtos.ConnectionRow;
import com.physiocare.clinic.integration.google.model.OAuthState;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** staff_google_calendars (one link per staff member) and google_oauth_states (one-time consent states). */
@Repository
public class GoogleConnectionRepository {
  /** A stored link before its refresh token is decrypted. */
  public record StoredConnection(String calendarId, String refreshTokenCiphertext) {}

  private final JdbcTemplate db;

  public GoogleConnectionRepository(JdbcTemplate db) {
    this.db = db;
  }

  // ------------------------------------------------------------ states

  /** Replaces any earlier unfinished attempt by this staff member, and clears stale ones. */
  public void saveState(String state, long staffId, long userId) {
    db.update(
        "DELETE FROM google_oauth_states WHERE created_at < now() - interval '1 hour' OR staff_id=?",
        staffId);
    db.update(
        "INSERT INTO google_oauth_states(state,staff_id,user_id) VALUES(?,?,?)", state, staffId, userId);
  }

  /** Deletes the state and returns who started it, so a state works once and only while fresh. */
  public Optional<OAuthState> consumeState(String state, long ttlSeconds) {
    return db.queryForList(
            "DELETE FROM google_oauth_states WHERE state=? AND created_at > now() - (? * interval '1 second')"
                + " RETURNING staff_id,user_id",
            state, ttlSeconds)
        .stream()
        .findFirst()
        .map(row -> new OAuthState(
            ((Number) row.get("staff_id")).longValue(), ((Number) row.get("user_id")).longValue()));
  }

  // ------------------------------------------------------- connections

  public Optional<Map<String, Object>> findStatusRow(long staffId) {
    return db.queryForList(
            "SELECT google_email,connected_at,last_error,last_error_at FROM staff_google_calendars"
                + " WHERE staff_id=?",
            staffId)
        .stream()
        .findFirst();
  }

  public Optional<StoredConnection> find(long staffId) {
    return db.queryForList(
            "SELECT calendar_id,refresh_token_ciphertext FROM staff_google_calendars WHERE staff_id=?",
            staffId)
        .stream()
        .findFirst()
        .map(row -> new StoredConnection(
            (String) row.get("calendar_id"), (String) row.get("refresh_token_ciphertext")));
  }

  public boolean exists(long staffId) {
    return Boolean.TRUE.equals(
        db.queryForObject(
            "SELECT EXISTS(SELECT 1 FROM staff_google_calendars WHERE staff_id=?)", Boolean.class, staffId));
  }

  public void upsert(long staffId, String googleEmail, String refreshTokenCiphertext, long connectedBy) {
    db.update(
        "INSERT INTO staff_google_calendars(staff_id,google_email,refresh_token_ciphertext,connected_by,"
            + "connected_at,last_error,last_error_at) VALUES(?,?,?,?,now(),NULL,NULL)"
            + " ON CONFLICT (staff_id) DO UPDATE SET google_email=EXCLUDED.google_email,"
            + " refresh_token_ciphertext=EXCLUDED.refresh_token_ciphertext,"
            + " connected_by=EXCLUDED.connected_by, connected_at=now(), last_error=NULL, last_error_at=NULL",
        staffId, googleEmail, refreshTokenCiphertext, connectedBy);
  }

  public void delete(long staffId) {
    db.update("DELETE FROM staff_google_calendars WHERE staff_id=?", staffId);
  }

  public void recordError(long staffId, String message) {
    db.update(
        "UPDATE staff_google_calendars SET last_error=?, last_error_at=now() WHERE staff_id=?",
        message, staffId);
  }

  public void clearError(long staffId) {
    db.update(
        "UPDATE staff_google_calendars SET last_error=NULL, last_error_at=NULL WHERE staff_id=?"
            + " AND last_error IS NOT NULL",
        staffId);
  }

  /** Every connected staff member with their name and how many pushes are still outstanding. */
  public List<ConnectionRow> listConnections() {
    return db.query(
        "SELECT c.staff_id, s.name AS staff_name, s.position, c.google_email, c.connected_at,"
            + " c.last_error, c.last_error_at,"
            + " (SELECT count(*) FROM appointment_calendar_events e WHERE e.staff_id=c.staff_id AND"
            + " e.sync_status IN ('PENDING','FAILED')) AS pending"
            + " FROM staff_google_calendars c JOIN staff s ON s.id=c.staff_id ORDER BY s.name, c.staff_id",
        (rs, i) -> new ConnectionRow(
            rs.getLong("staff_id"),
            rs.getString("staff_name"),
            rs.getString("position"),
            rs.getString("google_email"),
            rs.getObject("connected_at", OffsetDateTime.class),
            rs.getString("last_error"),
            rs.getObject("last_error_at", OffsetDateTime.class),
            rs.getInt("pending")));
  }
}
