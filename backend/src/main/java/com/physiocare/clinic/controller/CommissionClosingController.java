package com.physiocare.clinic.controller;

import com.physiocare.clinic.dto.commission.CommissionClosingDtos.CloseRequest;
import com.physiocare.clinic.dto.commission.CommissionClosingDtos.EmployeePreview;
import com.physiocare.clinic.dto.commission.CommissionClosingDtos.OverrideRequest;
import com.physiocare.clinic.service.MonthlyCommissionClosingService;
import com.physiocare.clinic.security.CurrentUser;
import jakarta.validation.Valid;
import java.time.YearMonth;
import java.util.List;
import java.util.Map;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

/** Event B of the requirement: previewing, running, and (rarely) overriding a monthly close. */
@RestController
@RequestMapping("/api/v1/commission/closing")
@PreAuthorize("@permissionGuard.hasAny(authentication, 'commission.view.all')")
public class CommissionClosingController {
  private final MonthlyCommissionClosingService closing;
  private final CurrentUser currentUser;

  public CommissionClosingController(MonthlyCommissionClosingService closing, CurrentUser currentUser) {
    this.closing = closing;
    this.currentUser = currentUser;
  }

  @GetMapping("/preview")
  public List<EmployeePreview> preview(
      @RequestParam String month) {
    return closing.preview(YearMonth.parse(month));
  }

  @PostMapping("/close")
  @PreAuthorize("@permissionGuard.hasAny(authentication, 'commission.close')")
  public Map<String, Object> close(@Valid @RequestBody CloseRequest request, Authentication authentication) {
    if (request.earlyClose() && (request.reason() == null || request.reason().isBlank()))
      throw new IllegalArgumentException("A reason is required for an early commission close");
    int count = closing.close(request.month(), currentUser.id(authentication), request.earlyClose(), request.reason());
    return Map.of("closedEmployees", count);
  }

  @GetMapping("/history")
  public List<Map<String, Object>> history(
      @RequestParam(required = false) String month, @RequestParam(required = false) Long employeeId) {
    return closing.history(month == null ? null : YearMonth.parse(month), employeeId);
  }

  @PostMapping("/{id}/override")
  @PreAuthorize("@permissionGuard.hasAny(authentication, 'settings.manage')")
  public void override(
      @PathVariable long id, @Valid @RequestBody OverrideRequest request, Authentication authentication) {
    if (request.reason() == null || request.reason().isBlank())
      throw new IllegalArgumentException("A reason is required to override a closed month's rate");
    closing.override(id, request.newRate(), request.reason(), currentUser.id(authentication));
  }
}
