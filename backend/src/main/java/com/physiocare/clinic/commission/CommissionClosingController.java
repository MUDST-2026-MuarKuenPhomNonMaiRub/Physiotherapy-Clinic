package com.physiocare.clinic.commission;

import com.physiocare.clinic.common.CurrentUser;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.YearMonth;
import java.util.List;
import java.util.Map;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

/** Event B of the requirement: previewing, running, and (rarely) overriding a monthly close. */
@RestController
@RequestMapping("/api/v1/commission/closing")
@PreAuthorize("hasAnyRole('ADMIN','FINANCE')")
public class CommissionClosingController {
  private final MonthlyCommissionClosingService closing;
  private final CurrentUser currentUser;

  public CommissionClosingController(MonthlyCommissionClosingService closing, CurrentUser currentUser) {
    this.closing = closing;
    this.currentUser = currentUser;
  }

  public record CloseRequest(@NotNull YearMonth month) {}

  public record OverrideRequest(@NotNull BigDecimal newRate, String reason) {}

  @GetMapping("/preview")
  public List<MonthlyCommissionClosingService.EmployeePreview> preview(
      @RequestParam String month) {
    return closing.preview(YearMonth.parse(month));
  }

  @PostMapping("/close")
  public Map<String, Object> close(@RequestBody CloseRequest request, Authentication authentication) {
    int count = closing.close(request.month(), currentUser.id(authentication));
    return Map.of("closedEmployees", count);
  }

  @GetMapping("/history")
  public List<Map<String, Object>> history(
      @RequestParam(required = false) String month, @RequestParam(required = false) Long employeeId) {
    return closing.history(month == null ? null : YearMonth.parse(month), employeeId);
  }

  @PostMapping("/{id}/override")
  @PreAuthorize("hasRole('ADMIN')")
  public void override(
      @PathVariable long id, @RequestBody OverrideRequest request, Authentication authentication) {
    if (request.reason() == null || request.reason().isBlank())
      throw new IllegalArgumentException("A reason is required to override a closed month's rate");
    closing.override(id, request.newRate(), request.reason(), currentUser.id(authentication));
  }
}
