package com.physiocare.clinic.commission;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.YearMonth;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Event B from the requirement: once a month, every seller's course sales for
 * that month are totalled, a tier rate is looked up and frozen onto every
 * course they sold that month, and any session already spent on one of those
 * courses before the freeze (recorded as PENDING_RATE) is allocated in the
 * same transaction the freeze happens in.
 */
@Service
public class MonthlyCommissionClosingService {
  private final JdbcTemplate db;
  private final CommissionAllocationService allocationService;
  private final CommissionAuditService audit;

  public MonthlyCommissionClosingService(
      JdbcTemplate db, CommissionAllocationService allocationService, CommissionAuditService audit) {
    this.db = db;
    this.allocationService = allocationService;
    this.audit = audit;
  }

  public record EmployeePreview(
      long employeeId,
      String employeeName,
      BigDecimal monthlySales,
      Long schemeId,
      Integer schemeVersion,
      BigDecimal suggestedRate,
      BigDecimal suggestedPool,
      boolean alreadyClosed) {}

  /** Read-only: what closing this month would produce, without writing anything. */
  public List<EmployeePreview> preview(YearMonth month) {
    List<Long> employees =
        db.queryForList(
            "SELECT DISTINCT seller_employee_id FROM patient_courses WHERE sale_month=? AND"
                + " commission_status='PROVISIONAL' AND seller_employee_id IS NOT NULL",
            Long.class,
            month.atDay(1));

    Map<String, Object> scheme = resolveScheme(month);
    return employees.stream()
        .map(
            employee -> {
              BigDecimal sales = monthlySales(month, employee);
              BigDecimal rate =
                  scheme == null ? BigDecimal.ZERO : resolveTierRate((Long) scheme.get("id"), sales);
              String name =
                  db.queryForList("SELECT name FROM staff WHERE id=?", String.class, employee).stream()
                      .findFirst()
                      .orElse("Unknown");
              boolean closed =
                  !db.queryForList(
                          "SELECT 1 FROM monthly_commission_closings WHERE closing_month=? AND"
                              + " employee_id=?",
                          month.atDay(1),
                          employee)
                      .isEmpty();
              return new EmployeePreview(
                  employee,
                  name,
                  sales,
                  scheme == null ? null : (Long) scheme.get("id"),
                  scheme == null ? null : (Integer) scheme.get("version"),
                  rate,
                  sales.multiply(rate).setScale(2, RoundingMode.HALF_UP),
                  closed);
            })
        .toList();
  }

  /** Closes every seller with unclosed course sales for the month. Already-closed employees are skipped. */
  @Transactional
  public int close(YearMonth month, Long actorUserId) {
    List<Long> employees =
        db.queryForList(
            "SELECT DISTINCT seller_employee_id FROM patient_courses WHERE sale_month=? AND"
                + " commission_status='PROVISIONAL' AND seller_employee_id IS NOT NULL",
            Long.class,
            month.atDay(1));
    int closedCount = 0;
    for (Long employee : employees) {
      if (closeEmployee(month, employee, actorUserId)) closedCount++;
    }
    return closedCount;
  }

  /** @return false when this employee/month was already closed (idempotent, not an error). */
  private boolean closeEmployee(YearMonth month, long employee, Long actorUserId) {
    Map<String, Object> scheme = resolveScheme(month);
    if (scheme == null)
      throw new IllegalStateException("No commission scheme covers " + month + " — configure one first");
    long schemeId = (Long) scheme.get("id");
    int schemeVersion = (Integer) scheme.get("version");

    BigDecimal sales = monthlySales(month, employee);
    BigDecimal rate = resolveTierRate(schemeId, sales);

    List<Long> closingIds =
        db.queryForList(
            "INSERT INTO monthly_commission_closings(closing_month,employee_id,monthly_course_sales,"
                + "scheme_id,commission_scheme_version,calculated_commission_rate,"
                + "locked_commission_rate,status,closed_at,closed_by) VALUES"
                + "(?,?,?,?,?,?,?,'CLOSED',now(),?) ON CONFLICT(closing_month,employee_id) DO NOTHING"
                + " RETURNING id",
            Long.class,
            month.atDay(1),
            employee,
            sales,
            schemeId,
            schemeVersion,
            rate,
            rate,
            actorUserId);
    if (closingIds.isEmpty()) return false; // already closed — idempotent no-op

    long closingId = closingIds.get(0);

    db.update(
        "UPDATE patient_courses SET commission_status='LOCKED', commission_scheme_id=?,"
            + " commission_scheme_version=?, locked_commission_rate=?, monthly_closing_id=?,"
            + " total_course_commission_pool=round(net_course_sale_amount*?,2),"
            + " commission_allocation_per_visit="
            + "   floor(round(net_course_sale_amount*?,2) / GREATEST(commissionable_visit_count,1) * 100) / 100"
            + " WHERE sale_month=? AND seller_employee_id=? AND commission_status='PROVISIONAL'",
        schemeId,
        schemeVersion,
        rate,
        closingId,
        rate,
        rate,
        month.atDay(1),
        employee);

    List<Long> pendingUsages =
        db.queryForList(
            "SELECT cu.id FROM course_usages cu JOIN patient_courses pc ON pc.id=cu.patient_course_id"
                + " WHERE pc.monthly_closing_id=? AND cu.status='PENDING_RATE' ORDER BY cu.usage_date,"
                + " cu.id",
            Long.class,
            closingId);
    for (Long usageId : pendingUsages) allocationService.allocate(usageId);

    return true;
  }

  public List<Map<String, Object>> history(YearMonth month, Long employeeId) {
    return db.queryForList(
        "SELECT mc.*, s.name AS employee_name FROM monthly_commission_closings mc JOIN staff s ON"
            + " s.id=mc.employee_id WHERE (?::date IS NULL OR mc.closing_month=?) AND (?::bigint IS"
            + " NULL OR mc.employee_id=?) ORDER BY mc.closing_month DESC, s.name",
        month == null ? null : month.atDay(1),
        month == null ? null : month.atDay(1),
        employeeId,
        employeeId);
  }

  /**
   * Admin override on an already-closed month: books the rate change as an
   * audited event and, per course, a RATE_OVERRIDE adjustment capturing the
   * pool delta. It does not retroactively touch owner-net splits already
   * released to a treating PT under the old rate — Finance reconciles that
   * manually via a MANUAL_CORRECTION adjustment if the difference is material.
   */
  @Transactional
  public void override(long closingId, BigDecimal newRate, String reason, Long actorUserId) {
    Map<String, Object> closing =
        db.queryForMap("SELECT * FROM monthly_commission_closings WHERE id=? FOR UPDATE", closingId);
    BigDecimal oldRate = (BigDecimal) closing.get("locked_commission_rate");

    db.update("UPDATE monthly_commission_closings SET locked_commission_rate=? WHERE id=?", newRate, closingId);

    List<Map<String, Object>> courses =
        db.queryForList(
            "SELECT id, net_course_sale_amount, total_course_commission_pool FROM patient_courses"
                + " WHERE monthly_closing_id=?",
            closingId);
    for (Map<String, Object> course : courses) {
      long courseId = ((Number) course.get("id")).longValue();
      BigDecimal net = (BigDecimal) course.get("net_course_sale_amount");
      BigDecimal oldPool = (BigDecimal) course.get("total_course_commission_pool");
      BigDecimal newPool = net.multiply(newRate).setScale(2, RoundingMode.HALF_UP);
      BigDecimal newPerVisit =
          db.queryForObject(
              "SELECT floor(?*100 / GREATEST(commissionable_visit_count,1)) / 100 FROM"
                  + " patient_courses WHERE id=?",
              BigDecimal.class,
              newPool,
              courseId);
      db.update(
          "UPDATE patient_courses SET locked_commission_rate=?, total_course_commission_pool=?,"
              + " commission_allocation_per_visit=? WHERE id=?",
          newRate,
          newPool,
          newPerVisit,
          courseId);
      db.update(
          "INSERT INTO commission_adjustments(patient_course_id,monthly_closing_id,adjustment_type,"
              + "gross_amount,reason,approved_by,created_by) VALUES(?,?,'RATE_OVERRIDE',?,?,?,?)",
          courseId,
          closingId,
          newPool.subtract(oldPool),
          reason,
          actorUserId,
          actorUserId);
    }

    audit.record(
        actorUserId,
        null,
        "COMMISSION_CLOSING_OVERRIDE",
        "monthly_commission_closings",
        String.valueOf(closingId),
        Map.of("locked_commission_rate", oldRate),
        Map.of("locked_commission_rate", newRate),
        reason);
  }

  private BigDecimal monthlySales(YearMonth month, long employee) {
    return db.queryForObject(
        "SELECT COALESCE(sum(net_course_sale_amount),0) FROM patient_courses WHERE sale_month=? AND"
            + " seller_employee_id=? AND commission_status='PROVISIONAL'",
        BigDecimal.class,
        month.atDay(1),
        employee);
  }

  private Map<String, Object> resolveScheme(YearMonth month) {
    List<Map<String, Object>> rows =
        db.queryForList(
            "SELECT id,version FROM commission_schemes WHERE active AND effective_from<=? AND"
                + " (effective_to IS NULL OR effective_to>=?) ORDER BY version DESC LIMIT 1",
            month.atEndOfMonth(),
            month.atDay(1));
    return rows.isEmpty() ? null : rows.get(0);
  }

  private BigDecimal resolveTierRate(long schemeId, BigDecimal sales) {
    List<BigDecimal> rows =
        db.queryForList(
            "SELECT commission_rate FROM commission_tiers WHERE scheme_id=? AND active AND"
                + " minimum_monthly_sales<=? AND (maximum_monthly_sales IS NULL OR"
                + " maximum_monthly_sales>=?) ORDER BY tier_order LIMIT 1",
            BigDecimal.class,
            schemeId,
            sales,
            sales);
    return rows.isEmpty() ? BigDecimal.ZERO : rows.get(0);
  }
}
