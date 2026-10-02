package com.physiocare.clinic.controller;

import com.physiocare.clinic.dto.common.PageResponse;
import com.physiocare.clinic.dto.patient.PatientDtos.PatientRequest;
import com.physiocare.clinic.service.PatientService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

/** HTTP adapter for patient registration and lookup. */
@RestController
@RequestMapping("/api/v1/patients")
public class PatientController {
  private final PatientService service;

  public PatientController(PatientService service) { this.service = service; }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  @PreAuthorize("@permissionGuard.hasAny(authentication, 'patient.create')")
  public Map<String, Object> create(@Valid @RequestBody PatientRequest r, Authentication authentication) {
    return service.create(r, authentication);
  }

  @GetMapping
  @PreAuthorize("@permissionGuard.hasAny(authentication, 'patient.view')")
  public List<Map<String, Object>> list(@RequestParam(defaultValue = "") String search,
      @RequestParam(required = false) Long branchId,
      @RequestParam(defaultValue = "200") int limit, Authentication authentication) {
    return service.list(search, branchId, limit, authentication);
  }

  /** New paginated contract; the legacy array endpoint remains for old clients. */
  @GetMapping("/page")
  @PreAuthorize("@permissionGuard.hasAny(authentication, 'patient.view')")
  public PageResponse<Map<String, Object>> page(
      @RequestParam(defaultValue = "") String search,
      @RequestParam(required = false) Long branchId,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "25") int size,
      Authentication authentication) {
    return service.page(search, branchId, page, size, authentication);
  }

  @GetMapping("/{id}")
  @PreAuthorize("@permissionGuard.hasAny(authentication, 'patient.view')")
  public Map<String, Object> get(@PathVariable long id, Authentication authentication) {
    return service.get(id, authentication);
  }

  @PatchMapping("/{id}")
  @PreAuthorize("@permissionGuard.hasAny(authentication, 'patient.edit')")
  public Map<String, Object> update(@PathVariable long id, @Valid @RequestBody PatientRequest r,
      Authentication authentication) { return service.update(id, r, authentication); }

  @GetMapping("/hn-preview")
  public Map<String, Object> hnPreview(@RequestParam long branchId, Authentication authentication) {
    return service.hnPreview(branchId, authentication);
  }
}
