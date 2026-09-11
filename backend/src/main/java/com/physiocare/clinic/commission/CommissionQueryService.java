package com.physiocare.clinic.commission;

import com.physiocare.clinic.common.CurrentUser;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;

/**
 * Every read in this file enforces its own scope — a physiotherapist gets
 * their own figures back no matter what staffId a request asks for. The
 * frontend's own filtering is a convenience, never the boundary.
 */
@Service
public class CommissionQueryService {
  private final JdbcTemplate db;
  private final CurrentUser currentUser;

  public CommissionQueryService(JdbcTemplate db, CurrentUser currentUser) {
    this.db = db;
    this.currentUser = currentUser;
  }

  public record ReportRow(
      long staffId,
      String staffName,
      BigDecimal monthlyCourseSales,
      BigDecimal commissionGenerated,
      BigDecimal grossAllocated,
      BigDecimal ownerNetReleased,
      BigDecimal treatmentFeeEarned,
      BigDecimal adjustments,
      BigDecimal outstandingPool,
      BigDecimal totalVariablePay) {}

  public List<ReportRow> report(LocalDate from, LocalDate to, Long requestedStaffId, Authentication auth) {
    Long staffFilter = effectiveStaffFilter(requestedStaffId, auth);
    List<Map<String, Object>> rows =
        db.queryForList(
            "WITH owner AS ("
                + "  SELECT case_owner_employee_id AS staff_id, sum(gross_commission_allocation) AS"
                + "  gross, sum(owner_net_commission) AS owner_net FROM commission_allocations WHERE"
                + "  allocation_status='ALLOCATED' AND visit_date BETWEEN ? AND ? GROUP BY"
                + "  case_owner_employee_id"
                + " ), treating AS ("
                + "  SELECT treating_employee_id AS staff_id, sum(treatment_fee_amount) AS fee FROM"
                + "  commission_allocations WHERE allocation_status='ALLOCATED' AND visit_date"
                + "  BETWEEN ? AND ? GROUP BY treating_employee_id"
                + " ), adj AS ("
                + "  SELECT pc.case_owner_employee_id AS staff_id, sum(a.owner_net_amount) AS"
                + "  adjustment FROM commission_adjustments a JOIN patient_courses pc ON"
                + "  pc.id=a.patient_course_id WHERE a.created_at::date BETWEEN ? AND ? GROUP BY"
                + "  pc.case_owner_employee_id"
                + " ), sales AS ("
                + "  SELECT seller_employee_id AS staff_id, sum(net_course_sale_amount) AS"
                + "  monthly_sales, sum(total_course_commission_pool) AS generated FROM"
                + "  patient_courses WHERE sale_month BETWEEN ? AND ? AND commission_status<>"
                + "  'LEGACY_EXCLUDED' GROUP BY seller_employee_id"
                + " ), outstanding AS ("
                + "  SELECT case_owner_employee_id AS staff_id, sum(total_course_commission_pool -"
                + "  gross_commission_allocated_total) AS outstanding FROM patient_courses WHERE"
                + "  commission_status='LOCKED' GROUP BY case_owner_employee_id"
                + " )"
                + " SELECT s.id AS staff_id, s.name,"
                + "   COALESCE(sales.monthly_sales,0) AS monthly_sales,"
                + "   COALESCE(sales.generated,0) AS generated,"
                + "   COALESCE(owner.gross,0) AS gross,"
                + "   COALESCE(owner.owner_net,0) AS owner_net,"
                + "   COALESCE(treating.fee,0) AS fee,"
                + "   COALESCE(adj.adjustment,0) AS adjustment,"
                + "   COALESCE(outstanding.outstanding,0) AS outstanding"
                + " FROM staff s"
                + " LEFT JOIN owner ON owner.staff_id=s.id"
                + " LEFT JOIN treating ON treating.staff_id=s.id"
                + " LEFT JOIN adj ON adj.staff_id=s.id"
                + " LEFT JOIN sales ON sales.staff_id=s.id"
                + " LEFT JOIN outstanding ON outstanding.staff_id=s.id"
                + " WHERE s.deleted_at IS NULL AND (?::bigint IS NULL OR s.id=?)"
                + "   AND (sales.staff_id IS NOT NULL OR owner.staff_id IS NOT NULL OR"
                + "        treating.staff_id IS NOT NULL OR adj.staff_id IS NOT NULL)"
                + " ORDER BY s.name",
            from, to, from, to, from, to, from, to, staffFilter, staffFilter);

    return rows.stream()
        .map(
            r -> {
              BigDecimal ownerNet = (BigDecimal) r.get("owner_net");
              BigDecimal fee = (BigDecimal) r.get("fee");
              BigDecimal adjustment = (BigDecimal) r.get("adjustment");
              return new ReportRow(
                  ((Number) r.get("staff_id")).longValue(),
                  (String) r.get("name"),
                  (BigDecimal) r.get("monthly_sales"),
                  (BigDecimal) r.get("generated"),
                  (BigDecimal) r.get("gross"),
                  ownerNet,
                  fee,
                  adjustment,
                  (BigDecimal) r.get("outstanding"),
                  ownerNet.add(fee).add(adjustment));
            })
        .toList();
  }

  public Map<String, Object> courseDetail(long patientCourseId, Authentication auth) {
    Map<String, Object> course =
        db.queryForMap("SELECT * FROM patient_courses WHERE id=?", patientCourseId);
    requireOwnRecordOrPrivileged((Number) course.get("case_owner_employee_id"), auth);

    List<Map<String, Object>> allocations =
        db.queryForList(
            "SELECT ca.*, tf.employee_id AS rule_employee_id FROM commission_allocations ca LEFT"
                + " JOIN treatment_fee_rules tf ON tf.id=ca.treatment_fee_rule_id WHERE"
                + " ca.patient_course_id=? ORDER BY ca.visit_date, ca.id",
            patientCourseId);
    List<Map<String, Object>> usages =
        db.queryForList(
            "SELECT * FROM course_usages WHERE patient_course_id=? ORDER BY usage_date, id",
            patientCourseId);
    List<Map<String, Object>> adjustments =
        db.queryForList(
            "SELECT * FROM commission_adjustments WHERE patient_course_id=? ORDER BY created_at",
            patientCourseId);
    List<Map<String, Object>> members =
        db.queryForList(
            "SELECT scm.patient_id, scm.role, scm.status, cmb.allocated_visits, cmb.used_visits FROM"
                + " shared_course_members scm LEFT JOIN course_member_balances cmb ON"
                + " cmb.patient_course_id=scm.patient_course_id AND cmb.patient_id=scm.patient_id"
                + " WHERE scm.patient_course_id=?",
            patientCourseId);

    return Map.of(
        "course", course,
        "allocations", allocations,
        "usages", usages,
        "adjustments", adjustments,
        "members", members);
  }

  private Long effectiveStaffFilter(Long requested, Authentication auth) {
    boolean privileged = currentUser.isAdmin(auth) || hasRole(auth, "FINANCE");
    if (privileged) return requested;
    Long ownStaffId = currentUser.staffId(auth);
    if (ownStaffId == null)
      throw new IllegalArgumentException("This account has no staff profile to report on");
    return ownStaffId;
  }

  private void requireOwnRecordOrPrivileged(Number caseOwnerId, Authentication auth) {
    boolean privileged = currentUser.isAdmin(auth) || hasRole(auth, "FINANCE") || hasRole(auth, "RECEPTIONIST");
    if (privileged) return;
    Long ownStaffId = currentUser.staffId(auth);
    if (caseOwnerId == null || ownStaffId == null || caseOwnerId.longValue() != ownStaffId)
      throw new IllegalArgumentException("Not authorized to view this course's commission detail");
  }

  private boolean hasRole(Authentication auth, String role) {
    return auth != null
        && auth.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("ROLE_" + role));
  }
}
