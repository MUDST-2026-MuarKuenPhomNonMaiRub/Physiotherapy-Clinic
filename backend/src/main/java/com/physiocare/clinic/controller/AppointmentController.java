package com.physiocare.clinic.controller;

import com.physiocare.clinic.dto.appointment.AppointmentDtos.AppointmentRequest;
import com.physiocare.clinic.dto.appointment.AppointmentDtos.ReasonRequest;
import com.physiocare.clinic.dto.appointment.AppointmentDtos.RescheduleRequest;
import com.physiocare.clinic.dto.appointment.AppointmentDtos.TimeChangeRequest;
import com.physiocare.clinic.dto.common.PageResponse;
import com.physiocare.clinic.service.AppointmentService;
import jakarta.validation.Valid;
import java.time.LocalDate;
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

  @GetMapping
  @PreAuthorize("@permissionGuard.hasAny(authentication, 'appointment.view')")
  public List<Map<String, Object>> list(
      @RequestParam(required = false) Long branchId,
      @RequestParam(required = false) LocalDate date,
      @RequestParam(required = false) Long patientId,
      @RequestParam(defaultValue = "200") int limit,
      Authentication authentication) {
    return service.list(branchId, date, patientId, limit, authentication);
  }

  @GetMapping("/page")
  @PreAuthorize("@permissionGuard.hasAny(authentication, 'appointment.view')")
  public PageResponse<Map<String, Object>> page(
      @RequestParam(required = false) Long branchId,
      @RequestParam(required = false) LocalDate date,
      @RequestParam(required = false) Long patientId,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "50") int size,
      Authentication authentication) {
    return service.page(branchId, date, patientId, page, size, authentication);
  }

  @GetMapping("/{id}")
  @PreAuthorize("@permissionGuard.hasAny(authentication, 'appointment.view')")
  public Map<String, Object> get(@PathVariable long id, Authentication authentication) {
    return service.get(id, authentication);
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  @PreAuthorize("@permissionGuard.hasAny(authentication, 'appointment.create')")
  public Map<String, Object> create(
      @Valid @RequestBody AppointmentRequest r, Authentication authentication) {
    return service.create(r, authentication);
  }

  @PostMapping("/{id}/reschedule")
  @PreAuthorize("@permissionGuard.hasAny(authentication, 'appointment.create')")
  public Map<String, Object> reschedule(
      @PathVariable long id, @Valid @RequestBody RescheduleRequest r, Authentication authentication) {
    return service.reschedule(id, r, authentication);
  }

  @PatchMapping("/{id}/time")
  @PreAuthorize("@permissionGuard.hasAny(authentication, 'appointment.edit')")
  public Map<String, Object> changeTime(
      @PathVariable long id, @Valid @RequestBody TimeChangeRequest r, Authentication authentication) {
    return service.changeTime(id, r, authentication);
  }

  @PostMapping("/{id}/{action}")
  @PreAuthorize("#action.toLowerCase() == 'cancel' or #action.toLowerCase() == 'noshow' ? @permissionGuard.hasAny(authentication, 'appointment.cancel') : @permissionGuard.hasAny(authentication, 'appointment.edit')")
  public Map<String, Object> transition(
      @PathVariable long id,
      @PathVariable String action,
      @RequestBody(required = false) ReasonRequest body,
      Authentication authentication) {
    return service.transition(id, action, body, authentication);
  }

}
