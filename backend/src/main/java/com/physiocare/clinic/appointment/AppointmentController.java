package com.physiocare.clinic.appointment;

import com.physiocare.clinic.common.BranchAccessService;
import jakarta.validation.*;
import jakarta.validation.constraints.*;
import java.time.*;
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

  public AppointmentController(JdbcTemplate db, BranchAccessService branches) {
    this.db = db;
    this.branches = branches;
  }

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

  @GetMapping
  public List<?> list(
      @RequestParam(required = false) Long branchId,
      @RequestParam(required = false) LocalDate date,
      Authentication authentication) {
    branches.requireFilter(authentication, branchId);
    return db.queryForList(
        "SELECT"
            + " id,appointment_no,patient_id,branch_id,provider_staff_id,service_id,starts_at,ends_at,status,patient_note"
            + " FROM appointments WHERE (CAST(? AS BIGINT) IS NULL OR branch_id=?) AND (CAST(? AS DATE) IS NULL OR"
            + " starts_at::date=?) ORDER BY starts_at",
        branchId,
        branchId,
        date,
        date);
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  @PreAuthorize("hasAnyRole('ADMIN','RECEPTIONIST','PHYSIO')")
  @Transactional
  public Object create(@Valid @RequestBody AppointmentRequest r, Authentication authentication) {
    branches.requireAccess(authentication, r.branchId());
    branches.requireActiveBranch(r.branchId());
    String no = "AP-" + System.currentTimeMillis();
    long id =
        db.queryForObject(
            "INSERT INTO"
                + " appointments(appointment_no,patient_id,branch_id,provider_staff_id,service_id,room_id,starts_at,ends_at,patient_note,internal_note)"
                + " VALUES(?,?,?,?,?,?,?,?,?,?) RETURNING id",
            Long.class,
            no,
            r.patientId(),
            r.branchId(),
            r.providerStaffId(),
            r.serviceId(),
            r.roomId(),
            r.startsAt(),
            r.endsAt(),
            r.patientNote(),
            r.internalNote());
    db.update(
        "INSERT INTO appointment_events(appointment_id,to_status,occurred_by) VALUES(?,"
            + " 'CONFIRMED',NULL)",
        id);
    return db.queryForMap("SELECT * FROM appointments WHERE id=?", id);
  }

  @PostMapping("/{id}/{action}")
  @PreAuthorize("hasAnyRole('ADMIN','RECEPTIONIST','PHYSIO')")
  @Transactional
  public Object transition(
      @PathVariable long id, @PathVariable String action, Authentication authentication) {
    String status =
        switch (action.toLowerCase()) {
          case "confirm" -> "CONFIRMED";
          case "arrive" -> "ARRIVED";
          case "start" -> "IN_SERVICE";
          case "complete" -> "COMPLETED";
          case "cancel" -> "CANCELLED";
          case "noshow" -> "NO_SHOW";
          case "reschedule" -> "RESCHEDULED";
          default -> throw new IllegalArgumentException("Invalid appointment action");
        };
    Map<String, Object> current =
        db.queryForMap("SELECT status,branch_id FROM appointments WHERE id=? FOR UPDATE", id);
    branches.requireAccess(authentication, ((Number) current.get("branch_id")).longValue());
    String old = (String) current.get("status");
    if (!isAllowedTransition(old, status))
      throw new IllegalArgumentException("Invalid appointment status transition");
    db.update(
        "UPDATE appointments SET status=?,updated_at=now(),cancelled_at=CASE WHEN ?='CANCELLED'"
            + " THEN now() ELSE cancelled_at END WHERE id=?",
        status,
        status,
        id);
    db.update(
        "INSERT INTO appointment_events(appointment_id,from_status,to_status) VALUES(?,?,?)",
        id,
        old,
        status);
    if ("COMPLETED".equals(status))
      db.update(
          "INSERT INTO"
              + " visits(appointment_id,patient_id,branch_id,treating_staff_id,completed_at,status)"
              + " SELECT id,patient_id,branch_id,provider_staff_id,now(),'COMPLETED' FROM"
              + " appointments WHERE id=? ON CONFLICT(appointment_id) DO UPDATE SET"
              + " status='COMPLETED',completed_at=now()",
          id);
    return db.queryForMap("SELECT * FROM appointments WHERE id=?", id);
  }

  private boolean isAllowedTransition(String from, String to) {
    return switch (from) {
      case "CONFIRMED" ->
          to.equals("ARRIVED")
              || to.equals("CANCELLED")
              || to.equals("NO_SHOW")
              || to.equals("RESCHEDULED");
      case "ARRIVED" -> to.equals("IN_SERVICE") || to.equals("CANCELLED");
      case "IN_SERVICE" -> to.equals("COMPLETED") || to.equals("CANCELLED");
      default -> false;
    };
  }
}
