package com.physiocare.clinic.appointment;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class AppointmentRepository {
  private static final String COLUMNS =
      "a.id,a.appointment_no,a.patient_id,a.branch_id,a.provider_staff_id,a.service_id,a.room_id,"
          + "a.starts_at,a.ends_at,a.status,a.patient_note,a.internal_note,a.cancel_reason_code,"
          + "a.created_at,EXISTS(SELECT 1 FROM sales_transactions st WHERE st.appointment_id=a.id"
          + " AND st.status<>'CANCELLED') AS checked_out,"
          // Completing a visit spends one session from the patient's course
          // (see AppointmentService); checkout has to know which course so it
          // links to that usage instead of spending a second session.
          + "(SELECT cu.patient_course_id FROM course_usages cu JOIN visits v ON v.id=cu.visit_id"
          + " WHERE v.appointment_id=a.id AND cu.status<>'REVERSED' LIMIT 1) AS used_patient_course_id";

  private final JdbcTemplate db;

  public AppointmentRepository(JdbcTemplate db) {
    this.db = db;
  }

  public List<Map<String, Object>> list(Long branchId, LocalDate date, Long patientId) {
    return db.queryForList(
        "SELECT " + COLUMNS
            + " FROM appointments a WHERE (?::bigint IS NULL OR a.branch_id=?) AND (?::date IS"
            + " NULL OR a.starts_at::date=?) AND (?::bigint IS NULL OR a.patient_id=?) ORDER BY"
            + " a.starts_at",
        branchId, branchId, date, date, patientId, patientId);
  }

  public Map<String, Object> get(long id) {
    List<Map<String, Object>> rows =
        db.queryForList("SELECT " + COLUMNS + " FROM appointments a WHERE a.id=?", id);
    if (rows.isEmpty()) throw new IllegalArgumentException("Appointment not found");
    return rows.get(0);
  }

  public long insert(AppointmentController.AppointmentRequest r, String appointmentNo, long createdBy) {
    return db.queryForObject(
        "INSERT INTO appointments(appointment_no,patient_id,branch_id,provider_staff_id,"
            + "service_id,room_id,starts_at,ends_at,patient_note,internal_note,created_by)"
            + " VALUES(?,?,?,?,?,?,?,?,?,?,?) RETURNING id",
        Long.class, appointmentNo, r.patientId(), r.branchId(), r.providerStaffId(), r.serviceId(),
        r.roomId(), r.startsAt(), r.endsAt(), r.patientNote(), r.internalNote(), createdBy);
  }

  public long insertRescheduled(AppointmentController.AppointmentRequest r, String appointmentNo,
      long createdBy, String patientNote) {
    return db.queryForObject(
        "INSERT INTO appointments(appointment_no,patient_id,branch_id,provider_staff_id,"
            + "service_id,room_id,starts_at,ends_at,patient_note,created_by)"
            + " VALUES(?,?,?,?,?,?,?,?,?,?) RETURNING id",
        Long.class, appointmentNo, r.patientId(), r.branchId(), r.providerStaffId(), r.serviceId(),
        r.roomId(), r.startsAt(), r.endsAt(), patientNote, createdBy);
  }

  public void addEvent(long appointmentId, String from, String to, String reason, long actorId) {
    db.update("INSERT INTO appointment_events(appointment_id,from_status,to_status,reason,occurred_by)"
        + " VALUES(?,?,?,?,?)", appointmentId, from, to, reason, actorId);
  }

  public void addInitialEvent(long appointmentId, long actorId) {
    db.update("INSERT INTO appointment_events(appointment_id,to_status,occurred_by) VALUES(?,'CONFIRMED',?)",
        appointmentId, actorId);
  }

  public Map<String, Object> lockForUpdate(long id) {
    return db.queryForMap("SELECT status,branch_id FROM appointments WHERE id=? FOR UPDATE", id);
  }

  public void updateStatus(long id, String status, String reason, Long actorId) {
    db.update(
        "UPDATE appointments SET status=?,updated_at=now(),"
            + "cancel_reason_code=CASE WHEN ? IN ('CANCELLED','NO_SHOW') THEN ? ELSE"
            + " cancel_reason_code END,"
            + "cancelled_at=CASE WHEN ?='CANCELLED' THEN now() ELSE cancelled_at END,"
            + "cancelled_by=CASE WHEN ?='CANCELLED' THEN ? ELSE cancelled_by END WHERE id=?",
        status, status, reason, status, status, actorId, id);
  }

  public void createCompletedVisit(long appointmentId) {
    db.update(
        "INSERT INTO visits(appointment_id,patient_id,branch_id,treating_staff_id,completed_at,"
            + "status) SELECT id,patient_id,branch_id,provider_staff_id,now(),'COMPLETED' FROM"
            + " appointments WHERE id=? ON CONFLICT(appointment_id) DO UPDATE SET"
            + " status='COMPLETED',completed_at=now()", appointmentId);
  }

  public List<Long> findEligibleCourseIds(long patientId) {
    return db.queryForList(
        "SELECT cmb.patient_course_id FROM course_member_balances cmb JOIN patient_courses pc"
            + " ON pc.id=cmb.patient_course_id WHERE cmb.patient_id=? AND pc.status='ACTIVE'"
            + " AND cmb.allocated_visits>cmb.used_visits AND (pc.valid_until IS NULL OR"
            + " pc.valid_until>=CURRENT_DATE) ORDER BY pc.valid_until NULLS LAST, pc.sale_date, pc.id"
            + " LIMIT 1", Long.class, patientId);
  }

  public Long nextAppointmentNumber() {
    db.queryForList("SELECT pg_advisory_xact_lock(hashtext(?))", Object.class, "appointments:appointment_no");
    return db.queryForObject("SELECT nextval('appointment_no_seq')", Long.class);
  }

  public int providerClashes(long providerId, Long excludeId, OffsetDateTime startsAt, OffsetDateTime endsAt) {
    return db.queryForObject(
        "SELECT count(*) FROM appointments WHERE provider_staff_id=? AND status IN"
            + " ('CONFIRMED','ARRIVED','IN_SERVICE','COMPLETED') AND (?::bigint IS NULL OR id<>?)"
            + " AND tstzrange(starts_at,ends_at,'[)') && tstzrange(?,?,'[)')",
        Integer.class, providerId, excludeId, excludeId, startsAt, endsAt);
  }

  public int roomClashes(long roomId, Long excludeId, OffsetDateTime startsAt, OffsetDateTime endsAt) {
    return db.queryForObject(
        "SELECT count(*) FROM appointments WHERE room_id=? AND status IN"
            + " ('CONFIRMED','ARRIVED','IN_SERVICE','COMPLETED') AND (?::bigint IS NULL OR id<>?)"
            + " AND tstzrange(starts_at,ends_at,'[)') && tstzrange(?,?,'[)')",
        Integer.class, roomId, excludeId, excludeId, startsAt, endsAt);
  }
}
