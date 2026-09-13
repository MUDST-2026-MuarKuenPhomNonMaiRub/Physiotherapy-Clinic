package com.physiocare.clinic.report;

import java.time.LocalDate;
import java.util.Map;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

/** HTTP adapter for report queries. */
@RestController
@RequestMapping("/api/v1/reports")
@PreAuthorize("@permissionGuard.hasAny(authentication, 'report.view')")
public class ReportController {
  private final ReportService service;
  public ReportController(ReportService service) { this.service = service; }
  @GetMapping("/summary")
  public Map<String,Object> summary(@RequestParam LocalDate from,@RequestParam LocalDate to,
      @RequestParam(required=false) Long branchId, Authentication authentication) {
    return service.summary(from,to,branchId,authentication);
  }
  @GetMapping("/course-balance")
  public Object courseBalance(@RequestParam Long branchId, Authentication authentication) {
    return service.courseBalance(branchId,authentication);
  }
  @GetMapping("/commissions")
  public Object commissions(@RequestParam LocalDate from,@RequestParam LocalDate to,
      @RequestParam Long branchId, Authentication authentication) {
    return service.commissions(from,to,branchId,authentication);
  }
}
