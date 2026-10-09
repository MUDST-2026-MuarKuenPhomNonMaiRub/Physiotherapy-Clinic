package com.physiocare.clinic.controller;

import com.physiocare.clinic.dto.checkout.LegacyTransferDtos.Report;
import com.physiocare.clinic.service.LegacyTransferReconciliationService;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

/** Admin-only report and execution path for legacy transfer repair. */
@RestController
@RequestMapping("/api/v1/admin/legacy-transfers")
public class LegacyTransferReconciliationController {
  private final LegacyTransferReconciliationService service;
  public LegacyTransferReconciliationController(LegacyTransferReconciliationService service) { this.service = service; }

  @PostMapping("/reconcile")
  @PreAuthorize("@permissionGuard.hasAny(authentication, 'settings.manage')")
  public Report reconcile(
      @RequestParam(defaultValue = "true") boolean dryRun) {
    return service.reconcile(dryRun);
  }
}
