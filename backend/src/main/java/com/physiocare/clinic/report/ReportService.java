package com.physiocare.clinic.report;

import com.physiocare.clinic.common.BranchAccessService;
import java.time.LocalDate;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.web.bind.annotation.*;

@Service
// A physiotherapist may read reports, but requireFilter/requireAccess keeps them
// to the branches they actually work at.
@PreAuthorize("@permissionGuard.hasAny(authentication, 'report.view')")
public class ReportService {
  private final JdbcTemplate db;
  private final BranchAccessService branches;

  public ReportService(JdbcTemplate db, BranchAccessService branches) {
    this.db = db;
    this.branches = branches;
  }

  @GetMapping("/summary")
  public Map<String, Object> summary(
      @RequestParam LocalDate from,
      @RequestParam LocalDate to,
      @RequestParam(required = false) Long branchId,
      Authentication authentication) {
    validateDateRange(from, to);
    branches.requireFilter(authentication, branchId);
    return Map.of(
        "uniquePatients",
        db.queryForObject(
            "SELECT count(DISTINCT patient_id) FROM visits WHERE completed_at::date BETWEEN ? AND ?"
                + " AND (?::bigint IS NULL OR branch_id=?)",
            Long.class,
            from,
            to,
            branchId,
            branchId),
        "visits",
        db.queryForObject(
            "SELECT count(*) FROM visits WHERE completed_at::date BETWEEN ? AND ? AND (?::bigint IS"
                + " NULL OR branch_id=?)",
            Long.class,
            from,
            to,
            branchId,
            branchId),
        "revenue",
        db.queryForObject(
            "SELECT COALESCE(sum(total_amount),0) FROM sales_transactions WHERE status IN"
                + " ('CONFIRMED','PAID') AND sold_at::date BETWEEN ? AND ? AND (?::bigint IS NULL"
                + " OR branch_id=?)",
            java.math.BigDecimal.class,
            from,
            to,
            branchId,
            branchId),
        "grossCommission",
        db.queryForObject(
            "SELECT COALESCE(sum(ca.gross_commission_allocation),0) FROM commission_allocations ca"
                + " JOIN visits v ON v.id=ca.visit_id WHERE ca.visit_date BETWEEN ? AND ? AND"
                + " (?::bigint IS NULL OR v.branch_id=?)",
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
        "WITH members AS ("
            + " SELECT patient_course_id, COALESCE(sum(used_visits),0) member_used"
            + " FROM course_member_balances GROUP BY patient_course_id)"
            + " SELECT pc.course_id,pc.patient_id,"
            + " pc.total_visits purchased,pc.bonus_visits bonus,"
            + " COALESCE(m.member_used,pc.visits_used) used,"
            + " pc.transfer_in_visits transfer_in,pc.transfer_out_visits transfer_out,"
            + " pc.transfer_in_visits-pc.transfer_out_visits transfer,"
            + " pc.total_visits,pc.bonus_visits,pc.visits_used,"
            + " pc.total_visits+pc.bonus_visits+pc.transfer_in_visits-"
            + " pc.transfer_out_visits-COALESCE(m.member_used,pc.visits_used) remaining,"
            + " pc.total_visits+pc.bonus_visits+pc.transfer_in_visits-"
            + " pc.transfer_out_visits-COALESCE(m.member_used,pc.visits_used) remaining_visits,"
            + " COALESCE(pc.total_course_commission_pool,0)-COALESCE(pc.gross_commission_allocated_total,0) outstanding"
            + " FROM patient_courses pc LEFT JOIN members m ON m.patient_course_id=pc.id"
            + " WHERE pc.branch_id=? ORDER BY pc.sale_date DESC NULLS LAST,pc.id DESC",
        branchId);
  }

  @GetMapping("/commissions")
  public Object commissions(
      @RequestParam LocalDate from,
      @RequestParam LocalDate to,
      @RequestParam Long branchId,
      Authentication authentication) {
    validateDateRange(from, to);
    branches.requireAccess(authentication, branchId);
    return db.queryForList(
        "SELECT employee_id treating_employee_id,sum(treatment_fee) treatment_fee,"
            + "sum(owner_net_commission) owner_net,sum(gross_commission_allocation) gross FROM ("
            + "SELECT ca.case_owner_employee_id employee_id,0 treatment_fee,ca.owner_net_commission,"
            + "ca.gross_commission_allocation FROM commission_allocations ca JOIN visits v "
            + "ON v.id=ca.visit_id WHERE ca.allocation_status='ALLOCATED' AND "
            + "ca.visit_date BETWEEN ? AND ? AND v.branch_id=? UNION ALL "
            + "SELECT ca.treating_employee_id employee_id,ca.treatment_fee_amount treatment_fee,"
            + "0 owner_net,0 gross_commission_allocation FROM commission_allocations ca JOIN visits v "
            + "ON v.id=ca.visit_id WHERE ca.allocation_status='ALLOCATED' AND "
            + "ca.visit_date BETWEEN ? AND ? AND v.branch_id=? AND ca.treating_employee_id<>ca.case_owner_employee_id"
            + ") allocations GROUP BY employee_id",
        from,
        to,
        branchId,
        from,
        to,
        branchId);
  }

  private void validateDateRange(LocalDate from, LocalDate to) {
    if (from == null || to == null || from.isAfter(to)) {
      throw new IllegalArgumentException("Report from date must not be after to date");
    }
    if (to.isAfter(from.plusYears(1))) {
      throw new IllegalArgumentException("Report date range must not exceed one year");
    }
  }
}
