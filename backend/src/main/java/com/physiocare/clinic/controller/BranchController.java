package com.physiocare.clinic.controller;

import com.physiocare.clinic.dto.branch.BranchDtos.StatusRequest;
import com.physiocare.clinic.service.BranchService;

import com.physiocare.clinic.dto.branch.BranchRequest;

import com.physiocare.clinic.model.Branch;

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
  @PreAuthorize("@permissionGuard.hasAny(authentication, 'settings.manage')")
  public Branch create(@Valid @RequestBody BranchRequest r) { return service.create(r); }
  @PatchMapping("/{id}")
  @PreAuthorize("@permissionGuard.hasAny(authentication, 'settings.manage')")
  public Branch update(@PathVariable long id, @Valid @RequestBody BranchRequest r) { return service.update(id,r); }
  @PatchMapping("/{id}/status")
  @PreAuthorize("@permissionGuard.hasAny(authentication, 'settings.manage')")
  public Branch updateStatus(@PathVariable long id, @RequestBody StatusRequest r) { return service.updateStatus(id,r); }
}
