package com.physiocare.clinic.staff;

import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/staff")
public class StaffController {
  private final StaffService service;

  public StaffController(StaffService s) {
    service = s;
  }

  @PostMapping
  @PreAuthorize("hasRole('ADMIN')")
  public StaffDtos.CreateResponse create(@Valid @RequestBody StaffDtos.CreateRequest r) {
    return service.create(r);
  }

  /** Readable by everyone signed in: the calendar and checkout screens need the roster. */
  @GetMapping
  public java.util.List<StaffDtos.Row> list() {
    return service.listActive();
  }

  @PatchMapping("/{id}")
  @PreAuthorize("hasRole('ADMIN')")
  public StaffDtos.Row update(@PathVariable long id, @Valid @RequestBody StaffDtos.UpdateRequest r) {
    return service.update(id, r);
  }

  @DeleteMapping("/{id}")
  @PreAuthorize("hasRole('ADMIN')")
  public void softDelete(@PathVariable long id) {
    service.softDelete(id);
  }

  @DeleteMapping("/by-email/{email}")
  @PreAuthorize("hasRole('ADMIN')")
  public void softDeleteByEmail(@PathVariable String email) {
    service.softDeleteByEmail(email);
  }
}
