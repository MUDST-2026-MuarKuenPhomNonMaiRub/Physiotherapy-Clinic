package com.physiocare.clinic.appointment;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/appointments")
public class AppointmentController {
  private final AppointmentService service;

  public AppointmentController(AppointmentService service) {
    this.service = service;
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

  public record RescheduleRequest(
      @NotNull OffsetDateTime startsAt, @NotNull OffsetDateTime endsAt, String reason) {}

  public record ReasonRequest(String reason) {}

  @GetMapping
  public List<Map<String, Object>> list(
      @RequestParam(required = false) Long branchId,
      @RequestParam(required = false) LocalDate date,
      @RequestParam(required = false) Long patientId,
      Authentication authentication) {
    return service.list(branchId, date, patientId, authentication);
  }

  @GetMapping("/{id}")
  public Map<String, Object> get(@PathVariable long id, Authentication authentication) {
    return service.get(id, authentication);
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  @PreAuthorize("hasAnyRole('ADMIN','PHYSIO','RECEPTIONIST')")
  public Map<String, Object> create(
      @Valid @RequestBody AppointmentRequest r, Authentication authentication) {
    return service.create(r, authentication);
  }

  @PostMapping("/{id}/reschedule")
  @PreAuthorize("hasAnyRole('ADMIN','PHYSIO','RECEPTIONIST')")
  public Map<String, Object> reschedule(
      @PathVariable long id, @Valid @RequestBody RescheduleRequest r, Authentication authentication) {
    return service.reschedule(id, r, authentication);
  }

  @PostMapping("/{id}/{action}")
  @PreAuthorize("hasAnyRole('ADMIN','PHYSIO','RECEPTIONIST')")
  public Map<String, Object> transition(
      @PathVariable long id,
      @PathVariable String action,
      @RequestBody(required = false) ReasonRequest body,
      Authentication authentication) {
    return service.transition(id, action, body, authentication);
  }

}
