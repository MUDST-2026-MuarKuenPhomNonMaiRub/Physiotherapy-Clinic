package com.physiocare.clinic.integration.google.repository;

import com.physiocare.clinic.integration.google.model.AppointmentEventSource;
import com.physiocare.clinic.integration.google.model.AppointmentSchedule;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** The read-only view of appointments that the calendar push needs. */
@Repository
public class AppointmentCalendarRepository {
  private final JdbcTemplate db;

  public AppointmentCalendarRepository(JdbcTemplate db) {
    this.db = db;
  }

  public Optional<AppointmentSchedule> findSchedule(long appointmentId) {
    return db.query(
            "SELECT provider_staff_id,status FROM appointments WHERE id=?",
            (rs, i) -> new AppointmentSchedule(rs.getLong("provider_staff_id"), rs.getString("status")),
            appointmentId)
        .stream()
        .findFirst();
  }

  public Optional<Long> findBranchId(long appointmentId) {
    return db.queryForList("SELECT branch_id FROM appointments WHERE id=?", Long.class, appointmentId)
        .stream()
        .findFirst();
  }

  public Optional<AppointmentEventSource> findEventSource(long appointmentId) {
    return db.query(
            "SELECT a.id,a.status,a.starts_at,a.ends_at,a.appointment_no,"
                + " p.hn,p.nickname,s.name_th AS service_name,r.name AS room_name,b.name AS branch_name,"
                + " b.address AS branch_address, b.timezone"
                + " FROM appointments a JOIN patients p ON p.id=a.patient_id"
                + " JOIN services s ON s.id=a.service_id JOIN branches b ON b.id=a.branch_id"
                + " LEFT JOIN rooms r ON r.id=a.room_id WHERE a.id=?",
            (rs, i) -> new AppointmentEventSource(
                rs.getLong("id"),
                rs.getString("status"),
                instant(rs.getObject("starts_at")),
                instant(rs.getObject("ends_at")),
                rs.getString("appointment_no"),
                rs.getString("hn"),
                rs.getString("nickname"),
                rs.getString("service_name"),
                rs.getString("room_name"),
                rs.getString("branch_name"),
                rs.getString("branch_address"),
                rs.getString("timezone")),
            appointmentId)
        .stream()
        .findFirst();
  }

  private static Instant instant(Object value) {
    if (value instanceof Timestamp t) return t.toInstant();
    if (value instanceof OffsetDateTime o) return o.toInstant();
    throw new IllegalStateException("Unexpected timestamp type " + value);
  }
}
