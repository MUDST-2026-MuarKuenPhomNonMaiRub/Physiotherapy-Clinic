package com.physiocare.clinic.appointment;

import com.physiocare.clinic.common.BranchAccessService;
import com.physiocare.clinic.common.CurrentUser;
import com.physiocare.clinic.common.InputRules;
import com.physiocare.clinic.commission.CourseUsageService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/appointments")
public class AppointmentController {
  private final JdbcTemplate db;
  private final BranchAccessService branches;
  private final CurrentUser currentUser;
  private final CourseUsageService courseUsage;

  public AppointmentController(
      JdbcTemplate db,
      BranchAccessService branches,
      CurrentUser currentUser,
      CourseUsageService courseUsage) {
    this.db = db;
    this.branches = branches;
    this.currentUser = currentUser;
    this.courseUsage = courseUsage;
  }

  /** Statuses that still hold the slot, so a second booking must not overlap them. */
  private static final String BLOCKING_STATUSES =
      "('CONFIRMED','ARRIVED','IN_SERVICE','COMPLETED')";

  private static final String COLUMNS =
      "a.id,a.appointment_no,a.patient_id,a.branch_id,a.provider_staff_id,a.service_id,a.room_id,"
          + "a.starts_at,a.ends_at,a.status,a.patient_note,a.internal_note,a.cancel_reason_code,"
          + "a.created_at,EXISTS(SELECT 1 FROM sales_transactions st WHERE st.appointment_id=a.id"
          + " AND st.status<>'CANCELLED') AS checked_out";

  public record AppointmentRequest(
      @Positive long patientId,
      @Positive long branchId,
      @Positive long providerStaffId,
      @Positive long serviceId,
      Long roomId,
      @NotNull OffsetDateTime startsAt,
      @NotNull OffsetDateTime endsAt,
      String patientNote,
      String internalNote) {}

  public record RescheduleRequest(
      @NotNull OffsetDateTime startsAt, @NotNull OffsetDateTime endsAt, String reason) {}

  public record ReasonRequest(String reason) {}

  @GetMapping
  public List<Map<String, Object>> list(
      @RequestParam(required = false) Long branchId,
      @RequestParam(required = false) LocalDate date,
      @RequestParam(required = false) Long patientId) {
    return db.queryForList(
        "SELECT " + COLUMNS
            + " FROM appointments a WHERE (?::bigint IS NULL OR a.branch_id=?) AND (?::date IS"
            + " NULL OR a.starts_at::date=?) AND (?::bigint IS NULL OR a.patient_id=?) ORDER BY"
            + " a.starts_at",
        branchId,
        branchId,
        date,
        date,
        patientId,
        patientId);
  }

  @GetMapping("/{id}")
  public Map<String, Object> get(@PathVariable long id) {
    List<Map<String, Object>> rows =
        db.queryForList("SELECT " + COLUMNS + " FROM appointments a WHERE a.id=?", id);
    if (rows.isEmpty()) throw new IllegalArgumentException("Appointment not found");
    return rows.get(0);
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  @PreAuthorize("hasAnyRole('ADMIN','PHYSIO','RECEPTIONIST')")
  @Transactional
  public Map<String, Object> create(
      @Valid @RequestBody AppointmentRequest r, Authentication authentication) {
    branches.requireAccess(authentication, r.branchId());
    branches.requireActiveBranch(r.branchId());
    validateSlot(r.startsAt(), r.endsAt());
    InputRules.text(r.patientNote(), 500, "The note");
    InputRules.text(r.internalNote(), 500, "The internal note");
    requireFreeSlot(r, null);

    long id =
        db.queryForObject(
            "INSERT INTO appointments(appointment_no,patient_id,branch_id,provider_staff_id,"
                + "service_id,room_id,starts_at,ends_at,patient_note,internal_note,created_by)"
                + " VALUES(?,?,?,?,?,?,?,?,?,?,?) RETURNING id",
            Long.class,
            nextAppointmentNo(),
            r.patientId(),
            r.branchId(),
            r.providerStaffId(),
            r.serviceId(),
            r.roomId(),
            r.startsAt(),
            r.endsAt(),
            r.patientNote(),
            r.internalNote(),
            currentUser.id(authentication));
    db.update(
        "INSERT INTO appointment_events(appointment_id,to_status,occurred_by)"
            + " VALUES(?,'CONFIRMED',?)",
        id,
        currentUser.id(authentication));
    return get(id);
  }

  @PostMapping("/{id}/reschedule")
  @PreAuthorize("hasAnyRole('ADMIN','PHYSIO','RECEPTIONIST')")
  @Transactional
  public Map<String, Object> reschedule(
      @PathVariable long id, @Valid @RequestBody RescheduleRequest r, Authentication authentication) {
    Map<String, Object> original = get(id);
    long branchId = ((Number) original.get("branch_id")).longValue();
    branches.requireAccess(authentication, branchId);
    validateSlot(r.startsAt(), r.endsAt());

    AppointmentRequest moved =
        new AppointmentRequest(
            ((Number) original.get("patient_id")).longValue(),
            branchId,
            ((Number) original.get("provider_staff_id")).longValue(),
            ((Number) original.get("service_id")).longValue(),
            original.get("room_id") == null ? null : ((Number) original.get("room_id")).longValue(),
            r.startsAt(),
            r.endsAt(),
            null,
            null);
    requireFreeSlot(moved, id);

    // The original is kept as RESCHEDULED so the move stays auditable, and the
    // new time becomes a fresh appointment rather than an in-place edit.
    transitionTo(id, "RESCHEDULED", r.reason(), authentication);

    OffsetDateTime originalStart = original.get("starts_at") == null
        ? null
        : ((java.sql.Timestamp) original.get("starts_at")).toInstant().atOffset(r.startsAt().getOffset());
    String note =
        (r.reason() == null || r.reason().isBlank())
            ? "Rescheduled from " + originalStart
            : "Rescheduled from " + originalStart + " — " + r.reason();

    long newId =
        db.queryForObject(
            "INSERT INTO appointments(appointment_no,patient_id,branch_id,provider_staff_id,"
                + "service_id,room_id,starts_at,ends_at,patient_note,created_by)"
                + " VALUES(?,?,?,?,?,?,?,?,?,?) RETURNING id",
            Long.class,
            nextAppointmentNo(),
            moved.patientId(),
            moved.branchId(),
            moved.providerStaffId(),
            moved.serviceId(),
            moved.roomId(),
            moved.startsAt(),
            moved.endsAt(),
            note,
            currentUser.id(authentication));
    db.update(
        "INSERT INTO appointment_events(appointment_id,to_status,reason,occurred_by)"
            + " VALUES(?,'CONFIRMED',?,?)",
        newId,
        note,
        currentUser.id(authentication));
    return get(newId);
  }

  @PostMapping("/{id}/{action}")
  @PreAuthorize("hasAnyRole('ADMIN','PHYSIO','RECEPTIONIST')")
  @Transactional
  public Map<String, Object> transition(
      @PathVariable long id,
      @PathVariable String action,
      @RequestBody(required = false) ReasonRequest body,
      Authentication authentication) {
    String status =
        switch (action.toLowerCase()) {
          case "confirm" -> "CONFIRMED";
          case "arrive" -> "ARRIVED";
          case "start" -> "IN_SERVICE";
          case "complete" -> "COMPLETED";
          case "cancel" -> "CANCELLED";
          case "noshow" -> "NO_SHOW";
          default -> throw new IllegalArgumentException("Invalid appointment action");
        };
    transitionTo(id, status, body == null ? null : body.reason(), authentication);
    return get(id);
  }

  private void transitionTo(long id, String status, String reason, Authentication authentication) {
    Map<String, Object> current =
        db.queryForMap("SELECT status,branch_id FROM appointments WHERE id=? FOR UPDATE", id);
    branches.requireAccess(authentication, ((Number) current.get("branch_id")).longValue());
    String from = (String) current.get("status");
    if (!isAllowedTransition(from, status))
      throw new IllegalArgumentException(
          "Cannot move an appointment from " + from + " to " + status);

    db.update(
        "UPDATE appointments SET status=?,updated_at=now(),"
            + "cancel_reason_code=CASE WHEN ? IN ('CANCELLED','NO_SHOW') THEN ? ELSE"
            + " cancel_reason_code END,"
            + "cancelled_at=CASE WHEN ?='CANCELLED' THEN now() ELSE cancelled_at END,"
            + "cancelled_by=CASE WHEN ?='CANCELLED' THEN ? ELSE cancelled_by END WHERE id=?",
        status,
        status,
        reason,
        status,
        status,
        currentUser.id(authentication),
        id);
    db.update(
        "INSERT INTO appointment_events(appointment_id,from_status,to_status,reason,occurred_by)"
            + " VALUES(?,?,?,?,?)",
        id,
        from,
        status,
        reason,
        currentUser.id(authentication));

    if ("COMPLETED".equals(status)) {
      db.update(
          "INSERT INTO visits(appointment_id,patient_id,branch_id,treating_staff_id,completed_at,"
              + "status) SELECT id,patient_id,branch_id,provider_staff_id,now(),'COMPLETED' FROM"
              + " appointments WHERE id=? ON CONFLICT(appointment_id) DO UPDATE SET"
              + " status='COMPLETED',completed_at=now()",
          id);
      recordAppointmentCourseUsage(id, authentication);
    }
  }

  /**
   * Completing an appointment is the operational Visit event. If the patient
   * has an active course balance, consume one session and let the commission
   * pipeline allocate it. Patients without a course remain ordinary single
   * visits and create no course commission.
   */
  private void recordAppointmentCourseUsage(long appointmentId, Authentication authentication) {
    Map<String, Object> appointment =
        db.queryForMap(
            "SELECT patient_id,branch_id,provider_staff_id FROM appointments WHERE id=?",
            appointmentId);
    List<Long> courseIds =
        db.queryForList(
            "SELECT cmb.patient_course_id FROM course_member_balances cmb JOIN patient_courses pc"
                + " ON pc.id=cmb.patient_course_id WHERE cmb.patient_id=? AND pc.status='ACTIVE'"
                + " AND cmb.allocated_visits>cmb.used_visits AND (pc.valid_until IS NULL OR"
                + " pc.valid_until>=CURRENT_DATE) ORDER BY pc.valid_until NULLS LAST, pc.sale_date, pc.id"
                + " LIMIT 1",
            Long.class,
            appointment.get("patient_id"));
    if (courseIds.isEmpty()) return;
    courseUsage.recordAppointmentUsage(
        courseIds.get(0),
        ((Number) appointment.get("patient_id")).longValue(),
        1,
        ((Number) appointment.get("branch_id")).longValue(),
        appointmentId,
        ((Number) appointment.get("provider_staff_id")).longValue(),
        currentUser.displayName(authentication),
        currentUser.id(authentication),
        LocalDate.now());
  }

  /**
   * A physiotherapist cannot be in two places at once, and a room holds one
   * appointment at a time. The database also enforces the provider rule, but
   * checking here turns a constraint violation into a message the counter can read.
   */
  private void requireFreeSlot(AppointmentRequest r, Long excludeId) {
    Integer providerClash =
        db.queryForObject(
            "SELECT count(*) FROM appointments WHERE provider_staff_id=? AND status IN"
                + BLOCKING_STATUSES
                + " AND (?::bigint IS NULL OR id<>?) AND tstzrange(starts_at,ends_at,'[)') &&"
                + " tstzrange(?,?,'[)')",
            Integer.class,
            r.providerStaffId(),
            excludeId,
            excludeId,
            r.startsAt(),
            r.endsAt());
    if (providerClash != null && providerClash > 0)
      throw new IllegalArgumentException(
          "This physiotherapist already has an appointment at that time");

    if (r.roomId() == null) return;
    Integer roomClash =
        db.queryForObject(
            "SELECT count(*) FROM appointments WHERE room_id=? AND status IN"
                + BLOCKING_STATUSES
                + " AND (?::bigint IS NULL OR id<>?) AND tstzrange(starts_at,ends_at,'[)') &&"
                + " tstzrange(?,?,'[)')",
            Integer.class,
            r.roomId(),
            excludeId,
            excludeId,
            r.startsAt(),
            r.endsAt());
    if (roomClash != null && roomClash > 0)
      throw new IllegalArgumentException("This treatment room is unavailable at that time");
  }

  /**
   * A slot has to run forwards, fit inside a working day, and fall on a day
   * that has not gone yet — a visit already past is recorded by moving the
   * appointment through its statuses, not by booking a new one behind today.
   */
  private void validateSlot(OffsetDateTime startsAt, OffsetDateTime endsAt) {
    InputRules.require(
        endsAt.isAfter(startsAt), "The end time must be after the start time");
    long minutes = java.time.Duration.between(startsAt, endsAt).toMinutes();
    InputRules.require(
        minutes <= InputRules.MAX_DURATION_MINUTES,
        "An appointment cannot run longer than "
            + (InputRules.MAX_DURATION_MINUTES / 60)
            + " hours");
    InputRules.bookingWindow(startsAt);
  }

  private boolean isAllowedTransition(String from, String to) {
    return switch (from) {
      case "CONFIRMED" ->
          List.of("ARRIVED", "CANCELLED", "NO_SHOW", "RESCHEDULED").contains(to);
      case "ARRIVED" -> List.of("IN_SERVICE", "CANCELLED", "NO_SHOW").contains(to);
      case "IN_SERVICE" -> List.of("COMPLETED", "CANCELLED").contains(to);
      default -> false;
    };
  }

  private String nextAppointmentNo() {
    Long sequence = db.queryForObject("SELECT count(*)+1 FROM appointments", Long.class);
    return String.format("AP-%s-%05d", java.time.Year.now().getValue(), sequence);
  }
}
