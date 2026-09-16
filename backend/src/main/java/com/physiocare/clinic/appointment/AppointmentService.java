package com.physiocare.clinic.appointment;

import com.physiocare.clinic.common.BranchAccessService;
import com.physiocare.clinic.common.CurrentUser;
import com.physiocare.clinic.commission.CourseUsageService;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AppointmentService {
  private final AppointmentRepository appointments;
  private final AppointmentValidator validator;
  private final AppointmentConflictService conflicts;
  private final BranchAccessService branches;
  private final CurrentUser currentUser;
  private final CourseUsageService courseUsage;

  public AppointmentService(AppointmentRepository appointments, AppointmentValidator validator,
      AppointmentConflictService conflicts, BranchAccessService branches, CurrentUser currentUser,
      CourseUsageService courseUsage) {
    this.appointments = appointments;
    this.validator = validator;
    this.conflicts = conflicts;
    this.branches = branches;
    this.currentUser = currentUser;
    this.courseUsage = courseUsage;
  }

  public List<Map<String, Object>> list(Long branchId, LocalDate date, Long patientId,
      Authentication authentication) {
    branches.requireFilter(authentication, branchId);
    return appointments.list(branchId, date, patientId);
  }

  public Map<String, Object> get(long id, Authentication authentication) {
    Map<String, Object> appointment = appointments.get(id);
    branches.requireAccess(authentication, ((Number) appointment.get("branch_id")).longValue());
    return appointment;
  }

  @Transactional
  public Map<String, Object> create(AppointmentController.AppointmentRequest r, Authentication auth) {
    branches.requireAccess(auth, r.branchId());
    branches.requireActiveBranch(r.branchId());
    validator.validateSlot(r.startsAt(), r.endsAt());
    validator.validateNotes(r.patientNote(), r.internalNote());
    conflicts.requireFreeSlot(r, null);
    long id = appointments.insert(r, nextAppointmentNo(), currentUser.id(auth));
    appointments.addInitialEvent(id, currentUser.id(auth));
    return get(id, auth);
  }

  @Transactional
  public Map<String, Object> reschedule(long id, AppointmentController.RescheduleRequest r,
      Authentication auth) {
    Map<String, Object> original = get(id, auth);
    long branchId = ((Number) original.get("branch_id")).longValue();
    branches.requireAccess(auth, branchId);
    validator.validateSlot(r.startsAt(), r.endsAt());
    AppointmentController.AppointmentRequest moved = new AppointmentController.AppointmentRequest(
        ((Number) original.get("patient_id")).longValue(), branchId,
        ((Number) original.get("provider_staff_id")).longValue(),
        ((Number) original.get("service_id")).longValue(),
        original.get("room_id") == null ? null : ((Number) original.get("room_id")).longValue(),
        r.startsAt(), r.endsAt(), null, null);
    conflicts.requireFreeSlot(moved, id);
    transitionTo(id, "RESCHEDULED", r.reason(), auth);
    OffsetDateTime originalStart = toOffsetDateTime(original.get("starts_at"), r.startsAt().getOffset());
    String note = (r.reason() == null || r.reason().isBlank())
        ? "Rescheduled from " + originalStart : "Rescheduled from " + originalStart + " — " + r.reason();
    long newId = appointments.insertRescheduled(moved, nextAppointmentNo(), currentUser.id(auth), note);
    appointments.addEvent(newId, null, "CONFIRMED", note, currentUser.id(auth));
    return get(newId, auth);
  }

  @Transactional
  public Map<String, Object> transition(long id, String action,
      AppointmentController.ReasonRequest body, Authentication auth) {
    String status = switch (action.toLowerCase()) {
      case "confirm" -> "CONFIRMED";
      case "arrive" -> "ARRIVED";
      case "start" -> "IN_SERVICE";
      case "complete" -> "COMPLETED";
      case "cancel" -> "CANCELLED";
      case "noshow" -> "NO_SHOW";
      default -> throw new IllegalArgumentException("Invalid appointment action");
    };
    transitionTo(id, status, body == null ? null : body.reason(),
        body == null ? null : body.usePatientCourseId(), auth);
    return get(id, auth);
  }

  private void transitionTo(long id, String status, String reason, Authentication auth) {
    transitionTo(id, status, reason, null, auth);
  }

  private void transitionTo(
      long id, String status, String reason, Long usePatientCourseId, Authentication auth) {
    Map<String, Object> current = appointments.lockForUpdate(id);
    branches.requireAccess(auth, ((Number) current.get("branch_id")).longValue());
    String from = (String) current.get("status");
    if (!isAllowedTransition(from, status)) {
      throw new IllegalArgumentException("Cannot move an appointment from " + from + " to " + status);
    }
    appointments.updateStatus(id, status, reason, currentUser.id(auth));
    appointments.addEvent(id, from, status, reason, currentUser.id(auth));
    if ("COMPLETED".equals(status)) {
      appointments.createCompletedVisit(id);
      if (usePatientCourseId != null) recordAppointmentCourseUsage(id, usePatientCourseId, auth);
    }
  }

  /**
   * Spends one session from the course the caller chose. The choice is
   * explicit because a patient may hold a course for a different treatment
   * than the one booked, or may simply be paying this visit per visit; the
   * server only checks that the named course is one the patient can spend
   * from right now (active, not expired, sessions left on their balance).
   */
  private void recordAppointmentCourseUsage(
      long appointmentId, long patientCourseId, Authentication auth) {
    Map<String, Object> appointment = appointments.get(appointmentId);
    long patientId = ((Number) appointment.get("patient_id")).longValue();
    List<Long> eligible = appointments.findEligibleCourseIds(patientId);
    if (!eligible.contains(patientCourseId))
      throw new IllegalArgumentException(
          "That course cannot be used for this visit: it is not active for this patient or has no"
              + " sessions left");
    courseUsage.recordAppointmentUsage(patientCourseId, patientId, 1,
        ((Number) appointment.get("branch_id")).longValue(), appointmentId,
        ((Number) appointment.get("provider_staff_id")).longValue(), currentUser.displayName(auth),
        currentUser.id(auth), LocalDate.now());
  }

  private boolean isAllowedTransition(String from, String to) {
    return switch (from) {
      case "CONFIRMED" -> List.of("ARRIVED", "CANCELLED", "NO_SHOW", "RESCHEDULED").contains(to);
      case "ARRIVED" -> List.of("IN_SERVICE", "CANCELLED", "NO_SHOW").contains(to);
      case "IN_SERVICE" -> List.of("COMPLETED", "CANCELLED").contains(to);
      default -> false;
    };
  }

  private String nextAppointmentNo() {
    return String.format("AP-%s-%05d", java.time.Year.now().getValue(), appointments.nextAppointmentNumber());
  }

  private OffsetDateTime toOffsetDateTime(Object value, java.time.ZoneOffset offset) {
    if (value instanceof OffsetDateTime dateTime) return dateTime;
    if (value instanceof Timestamp timestamp) return timestamp.toInstant().atOffset(offset);
    throw new IllegalArgumentException("Appointment start time is invalid");
  }
}
