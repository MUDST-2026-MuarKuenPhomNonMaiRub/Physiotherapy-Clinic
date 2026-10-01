package com.physiocare.clinic.appointment;

import com.physiocare.clinic.common.BranchAccessService;
import com.physiocare.clinic.common.PageResponse;
import com.physiocare.clinic.common.CurrentUser;
import com.physiocare.clinic.commission.CourseUsageService;
import com.physiocare.clinic.integration.google.service.GoogleCalendarSyncService;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AppointmentService {
  /** How a moved appointment's old slot is written into its note: "12 Oct 2026 10:00". */
  private static final DateTimeFormatter NOTE_TIME =
      DateTimeFormatter.ofPattern("dd MMM yyyy HH:mm", Locale.ENGLISH);

  private final AppointmentRepository appointments;
  private final AppointmentValidator validator;
  private final AppointmentConflictService conflicts;
  private final BranchAccessService branches;
  private final CurrentUser currentUser;
  private final CourseUsageService courseUsage;
  private final GoogleCalendarSyncService calendarSync;

  public AppointmentService(AppointmentRepository appointments, AppointmentValidator validator,
      AppointmentConflictService conflicts, BranchAccessService branches, CurrentUser currentUser,
      CourseUsageService courseUsage, GoogleCalendarSyncService calendarSync) {
    this.appointments = appointments;
    this.validator = validator;
    this.conflicts = conflicts;
    this.branches = branches;
    this.currentUser = currentUser;
    this.courseUsage = courseUsage;
    this.calendarSync = calendarSync;
  }

  public List<Map<String, Object>> list(Long branchId, LocalDate date, Long patientId,
      int limit, Authentication authentication) {
    branches.requireFilter(authentication, branchId);
    return appointments.list(branchId, date, patientId, Math.min(Math.max(limit, 1), 1000));
  }

  public PageResponse<Map<String, Object>> page(Long branchId, LocalDate date, Long patientId,
      int page, int size, Authentication authentication) {
    branches.requireFilter(authentication, branchId);
    return appointments.page(branchId, date, patientId, page, size);
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
    branches.requirePatientExists(r.patientId());
    if (!appointments.isActiveService(r.serviceId()))
      throw new IllegalArgumentException("This service is not available for booking");
    requireBookableAt(r);
    conflicts.requireFreeSlot(r, null);
    long id = appointments.insert(r, nextAppointmentNo(), currentUser.id(auth));
    appointments.addInitialEvent(id, currentUser.id(auth));
    calendarSync.appointmentChanged(id);
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
    requireBookableAt(moved);
    conflicts.requireFreeSlot(moved, id);
    transitionTo(id, "RESCHEDULED", r.reason(), auth);
    // The old slot is written in the clinic's own time (the JVM is pinned to it,
    // see TimeZoneConfig): the instant arrives in UTC, and "03:00Z" on a note
    // reads as the wrong hour to everyone at the counter.
    OffsetDateTime originalStart = toOffsetDateTime(original.get("starts_at"), r.startsAt().getOffset());
    String moveNote = "Rescheduled from "
        + NOTE_TIME.format(originalStart.atZoneSameInstant(ZoneId.systemDefault()))
        + (r.reason() == null || r.reason().isBlank() ? "" : " — " + r.reason());
    // The booking's own notes travel with it; the move is added underneath.
    String patientNote = (String) original.get("patient_note");
    String note = patientNote == null || patientNote.isBlank() ? moveNote : patientNote + "\n" + moveNote;
    long newId = appointments.insertRescheduled(
        moved, nextAppointmentNo(), currentUser.id(auth), note, (String) original.get("internal_note"));
    appointments.addEvent(newId, null, "CONFIRMED", moveNote, currentUser.id(auth));
    calendarSync.appointmentChanged(newId);
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
    // Every status change reaches the therapist's Google Calendar: a live
    // status refreshes the event, cancel / no-show / reschedule removes it.
    calendarSync.appointmentChanged(id);
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

  /**
   * The physiotherapist and room must belong to the branch the visit is at,
   * as checkout already requires — the booking screen only offers those, but
   * the API is reachable without it. Checked on a move too: the therapist may
   * have left the branch since the visit was first booked.
   */
  private void requireBookableAt(AppointmentController.AppointmentRequest r) {
    branches.requireStaffInBranch(r.providerStaffId(), r.branchId(), "This physiotherapist");
    if (r.roomId() != null && !appointments.isActiveRoomInBranch(r.roomId(), r.branchId()))
      throw new IllegalArgumentException("This treatment room is not available in this branch");
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
