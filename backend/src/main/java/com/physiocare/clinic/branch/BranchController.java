package com.physiocare.clinic.branch;

import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

/** HTTP adapter for branch management. */
@RestController
@RequestMapping({"/api/v1/branches", "/api/branches"})
public class BranchController {
  private final BranchService service;
  public BranchController(BranchService service) { this.service = service; }
  @GetMapping public List<Branch> list() { return service.list(); }
  @PostMapping @ResponseStatus(HttpStatus.CREATED)
  @PreAuthorize("hasRole('ADMIN')")
  public Branch create(@Valid @RequestBody BranchRequest r) { return service.create(r); }
  @PatchMapping("/{id}")
  @PreAuthorize("hasRole('ADMIN')")
  public Branch update(@PathVariable long id, @Valid @RequestBody BranchRequest r) { return service.update(id,r); }
  @PatchMapping("/{id}/status")
  @PreAuthorize("hasRole('ADMIN')")
  public Branch updateStatus(@PathVariable long id, @RequestBody BranchService.StatusRequest r) { return service.updateStatus(id,r); }
}
