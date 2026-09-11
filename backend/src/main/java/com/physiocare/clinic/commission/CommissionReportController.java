package com.physiocare.clinic.commission;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/commission")
public class CommissionReportController {
  private final CommissionQueryService query;

  public CommissionReportController(CommissionQueryService query) {
    this.query = query;
  }

  /**
   * Generated / Gross / Owner Net / Treatment Fee / Adjustment / Outstanding
   * per staff member. A physiotherapist gets only their own row back — see
   * {@link CommissionQueryService#report} — regardless of the staffId passed
   * here.
   */
  @GetMapping("/report")
  public List<CommissionQueryService.ReportRow> report(
      @RequestParam LocalDate from,
      @RequestParam LocalDate to,
      @RequestParam(required = false) Long staffId,
      Authentication authentication) {
    return query.report(from, to, staffId, authentication);
  }

  @GetMapping("/courses/{id}/detail")
  public Map<String, Object> courseDetail(@PathVariable long id, Authentication authentication) {
    return query.courseDetail(id, authentication);
  }

  @GetMapping("/staff/{id}/detail")
  public List<Map<String, Object>> staffDetail(
      @PathVariable long id,
      @RequestParam LocalDate from,
      @RequestParam LocalDate to,
      Authentication authentication) {
    return query.staffDetail(id, from, to, authentication);
  }
}
