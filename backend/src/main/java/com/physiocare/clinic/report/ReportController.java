package com.physiocare.clinic.report;

import com.physiocare.clinic.common.BranchAccessService;
import java.time.LocalDate;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/reports")
@PreAuthorize("hasAnyRole('ADMIN','FINANCE','REPORT_VIEWER')")
public class ReportController {
  private final JdbcTemplate db;
  private final BranchAccessService branches;

  public ReportController(JdbcTemplate db, BranchAccessService branches) {
    this.db = db;
    this.branches = branches;
  }

  @GetMapping("/summary")
  public Map<String, Object> summary(
      @RequestParam LocalDate from,
      @RequestParam LocalDate to,
      @RequestParam(required = false) Long branchId,
      Authentication authentication) {
    branches.requireFilter(authentication, branchId);
    return Map.of(
        "uniquePatients",
        db.queryForObject(
            "SELECT count(DISTINCT patient_id) FROM visits WHERE completed_at::date BETWEEN ? AND ?"
                + " AND (? IS NULL OR branch_id=?)",
            Long.class,
            from,
            to,
            branchId,
            branchId),
        "visits",
        db.queryForObject(
            "SELECT count(*) FROM visits WHERE completed_at::date BETWEEN ? AND ? AND (? IS NULL OR"
                + " branch_id=?)",
            Long.class,
            from,
            to,
            branchId,
            branchId),
        "revenue",
        db.queryForObject(
            "SELECT COALESCE(sum(total_amount),0) FROM sales_transactions WHERE status IN"
                + " ('CONFIRMED','PAID') AND sold_at::date BETWEEN ? AND ? AND (? IS NULL OR"
                + " branch_id=?)",
            java.math.BigDecimal.class,
            from,
            to,
            branchId,
            branchId),
        "grossCommission",
        db.queryForObject(
            "SELECT COALESCE(sum(ca.gross_commission_allocation),0) FROM commission_allocations ca"
                + " JOIN visits v ON v.id=ca.visit_id WHERE ca.visit_date BETWEEN ? AND ? AND"
                + " (? IS NULL OR v.branch_id=?)",
            java.math.BigDecimal.class,
            from,
            to,
            branchId,
            branchId));
  }

  @GetMapping("/course-balance")
  public Object courseBalance(@RequestParam Long branchId, Authentication authentication) {
    branches.requireAccess(authentication, branchId);
    return db.queryForList(
        "SELECT"
            + " pc.course_id,pc.patient_id,pc.total_visits,pc.visits_used,pc.total_visits-pc.visits_used"
            + " remaining_visits,pc.total_course_commission_pool-pc.gross_commission_allocated_total"
            + " outstanding FROM patient_courses pc JOIN sales_transactions st ON"
            + " st.id=pc.sales_transaction_id WHERE st.branch_id=? ORDER BY pc.sale_date DESC",
        branchId);
  }

  @GetMapping("/commissions")
  public Object commissions(
      @RequestParam LocalDate from,
      @RequestParam LocalDate to,
      @RequestParam Long branchId,
      Authentication authentication) {
    branches.requireAccess(authentication, branchId);
    return db.queryForList(
        "SELECT treating_employee_id,sum(treatment_fee_amount)"
            + " treatment_fee,sum(owner_net_commission) owner_net,sum(gross_commission_allocation)"
            + " gross FROM commission_allocations ca JOIN visits v ON v.id=ca.visit_id WHERE"
            + " ca.visit_date BETWEEN ? AND ? AND v.branch_id=? GROUP BY treating_employee_id",
        from,
        to,
        branchId);
  }
}
