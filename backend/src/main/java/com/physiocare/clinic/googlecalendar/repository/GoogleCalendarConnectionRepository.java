package com.physiocare.clinic.googlecalendar.repository;

import com.physiocare.clinic.googlecalendar.model.ConnectionStatus;
import com.physiocare.clinic.googlecalendar.model.GoogleCalendarConnection;
import com.physiocare.clinic.googlecalendar.model.GoogleCalendarDtos.StaffConnectionResponse;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class GoogleCalendarConnectionRepository {
  private static final String COLUMNS =
      "id,staff_id,google_email,refresh_token_ciphertext,calendar_id,status,last_error,connected_at";

  private final JdbcTemplate db;

  public GoogleCalendarConnectionRepository(JdbcTemplate db) {
    this.db = db;
  }

  public Optional<GoogleCalendarConnection> findByStaffId(long staffId) {
    return db.query(
            "SELECT " + COLUMNS + " FROM google_calendar_connections WHERE staff_id=?",
            this::mapConnection,
            staffId)
        .stream()
        .findFirst();
  }

  /** Links (or re-links) a staff member, clearing any earlier re-authorisation flag. */
  public void upsert(long staffId, String googleEmail, String refreshTokenCiphertext, Long connectedBy) {
    db.update(
        "INSERT INTO google_calendar_connections(staff_id,google_email,refresh_token_ciphertext,"
            + "connected_by) VALUES(?,?,?,?) ON CONFLICT(staff_id) DO UPDATE SET"
            + " google_email=EXCLUDED.google_email,"
            + " refresh_token_ciphertext=EXCLUDED.refresh_token_ciphertext,"
            + " connected_by=EXCLUDED.connected_by, status='ACTIVE', last_error=NULL,"
            + " connected_at=now(), updated_at=now()",
        staffId, googleEmail, refreshTokenCiphertext, connectedBy);
  }

  public void markReauthRequired(long staffId, String error) {
    db.update(
        "UPDATE google_calendar_connections SET status='REAUTH_REQUIRED',last_error=?,"
            + "updated_at=now() WHERE staff_id=?",
        error, staffId);
  }

  public void deleteByStaffId(long staffId) {
    db.update("DELETE FROM google_calendar_connections WHERE staff_id=?", staffId);
  }

  /** True when the staff record exists and belongs to that login. */
  public boolean staffBelongsToUser(long staffId, long userId) {
    Integer count = db.queryForObject(
        "SELECT count(*) FROM staff WHERE id=? AND user_id=? AND deleted_at IS NULL",
        Integer.class, staffId, userId);
    return count != null && count > 0;
  }

  /** Every staff member who can sign in, with their connection if they have one. */
  public List<StaffConnectionResponse> listStaffConnections() {
    return db.query(
        "SELECT s.id,s.name,s.position,c.google_email,c.status,c.connected_at,c.last_error"
            + " FROM staff s LEFT JOIN google_calendar_connections c ON c.staff_id=s.id"
            + " WHERE s.deleted_at IS NULL AND s.user_id IS NOT NULL ORDER BY s.name",
        (rs, i) -> new StaffConnectionResponse(
            rs.getLong("id"),
            rs.getString("name"),
            rs.getString("position"),
            rs.getString("status") != null,
            rs.getString("google_email"),
            rs.getString("status"),
            rs.getObject("connected_at", OffsetDateTime.class),
            rs.getString("last_error")));
  }

  private GoogleCalendarConnection mapConnection(ResultSet rs, int row) throws SQLException {
    return new GoogleCalendarConnection(
        rs.getLong("id"),
        rs.getLong("staff_id"),
        rs.getString("google_email"),
        rs.getString("refresh_token_ciphertext"),
        rs.getString("calendar_id"),
        ConnectionStatus.valueOf(rs.getString("status")),
        rs.getString("last_error"),
        rs.getObject("connected_at", OffsetDateTime.class));
  }
}
