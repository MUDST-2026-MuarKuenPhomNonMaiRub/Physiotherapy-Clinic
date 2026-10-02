package com.physiocare.clinic.service;

import com.physiocare.clinic.dto.checkout.CheckoutDtos;
import com.physiocare.clinic.util.InputRules;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/** Owns sale-time multi-PT credit and the matching visit-owner buckets. */
@Service
public class CourseCommissionSplitService {
  private final JdbcTemplate db;

  public CourseCommissionSplitService(JdbcTemplate db) {
    this.db = db;
  }

  public record NormalizedSplit(long employeeId, BigDecimal salesCreditAmount, int visits) {}

  public record UsageSplit(long id, long employeeId, String commissionStatus) {}

  public List<NormalizedSplit> normalize(
      List<CheckoutDtos.CourseCommissionSplit> requested,
      Long defaultOwnerId,
      BigDecimal fullCoursePrice,
      int totalVisitsIncludingBonus) {
    List<NormalizedSplit> result = new ArrayList<>();
    if (requested == null || requested.isEmpty()) {
      if (defaultOwnerId == null) throw new IllegalArgumentException("A course owner is required");
      result.add(new NormalizedSplit(defaultOwnerId, money(fullCoursePrice), totalVisitsIncludingBonus));
      return result;
    }

    Set<Long> employees = new HashSet<>();
    BigDecimal creditTotal = BigDecimal.ZERO;
    int visitTotal = 0;
    for (CheckoutDtos.CourseCommissionSplit split : requested) {
      if (!employees.add(split.employeeId()))
        throw new IllegalArgumentException("Each physiotherapist may appear only once in a course split");
      InputRules.money(split.salesCreditAmount(), "A split sales credit");
      if (split.salesCreditAmount().signum() <= 0)
        throw new IllegalArgumentException("A split sales credit must be more than 0");
      if (split.visits() <= 0) throw new IllegalArgumentException("Split visits must be more than 0");
      BigDecimal amount = money(split.salesCreditAmount());
      result.add(new NormalizedSplit(split.employeeId(), amount, split.visits()));
      creditTotal = creditTotal.add(amount);
      visitTotal += split.visits();
    }
    if (creditTotal.compareTo(money(fullCoursePrice)) != 0)
      throw new IllegalArgumentException(
          "Course split sales credits must total the full course price of " + money(fullCoursePrice));
    if (visitTotal != totalVisitsIncludingBonus)
      throw new IllegalArgumentException(
          "Course split visits must total all paid and bonus visits (" + totalVisitsIncludingBonus + ")");
    return List.copyOf(result);
  }

  public void requireOpenSaleMonth(List<NormalizedSplit> splits, LocalDate saleDate) {
    LocalDate month = saleDate.withDayOfMonth(1);
    for (NormalizedSplit split : splits) {
      db.queryForList(
          "SELECT pg_advisory_xact_lock(hashtext(?))",
          Object.class,
          "monthly-commission:" + split.employeeId() + ":" + month);
      if (Boolean.TRUE.equals(
          db.queryForObject(
              "SELECT EXISTS(SELECT 1 FROM monthly_commission_closings WHERE closing_month=?"
                  + " AND employee_id=? AND status='CLOSED')",
              Boolean.class,
              month,
              split.employeeId()))) {
        throw new IllegalArgumentException(
            "Cannot create a course sale: commission month " + month
                + " is closed for staff " + split.employeeId());
      }
    }
  }

  /** Persists the split snapshot and, for SPECIAL_IMMEDIATE, pays it now. */
  public BigDecimal createForSale(
      long patientCourseId,
      long salesTransactionId,
      Map<String, Object> courseTemplate,
      List<NormalizedSplit> splits) {
    String mode = String.valueOf(courseTemplate.getOrDefault("commission_mode", "STANDARD_TIERED"));
    boolean immediate = "SPECIAL_IMMEDIATE".equals(mode);
    BigDecimal specialValue = (BigDecimal) courseTemplate.get("special_commission_value");
    String specialType = (String) courseTemplate.get("special_commission_type");
    BigDecimal fullCredit = splits.stream()
        .map(NormalizedSplit::salesCreditAmount)
        .reduce(BigDecimal.ZERO, BigDecimal::add);
    BigDecimal specialTotal = immediate
        ? specialTotal(specialType, specialValue, fullCredit)
        : BigDecimal.ZERO;

    BigDecimal assignedImmediate = BigDecimal.ZERO;
    for (int index = 0; index < splits.size(); index++) {
      NormalizedSplit split = splits.get(index);
      BigDecimal immediateAmount = BigDecimal.ZERO;
      if (immediate) {
        immediateAmount = index == splits.size() - 1
            ? specialTotal.subtract(assignedImmediate)
            : specialTotal.multiply(split.salesCreditAmount())
                .divide(fullCredit, 2, RoundingMode.HALF_UP);
        assignedImmediate = assignedImmediate.add(immediateAmount);
      }
      db.update(
          "INSERT INTO course_commission_splits(patient_course_id,employee_id,employee_name_snapshot,"
              + "split_order,sales_credit_amount,allocated_visits,commission_status,"
              + "immediate_commission_amount) VALUES(?, ?, (SELECT name FROM staff WHERE id=?),"
              + " ?,?,?,?,?)",
          patientCourseId,
          split.employeeId(),
          split.employeeId(),
          index + 1,
          split.salesCreditAmount(),
          split.visits(),
          immediate ? "PAID_IMMEDIATE" : "PROVISIONAL",
          immediateAmount);
      if (immediate && immediateAmount.signum() > 0) {
        db.update(
            "INSERT INTO transaction_commissions(sales_transaction_id,commission_rule_id,"
                + "rule_name_snapshot,staff_id,commission_type,amount) VALUES(?,NULL,?,?,"
                + "'SALES',?)",
            salesTransactionId,
            "Special immediate course commission (" + specialType + ")",
            split.employeeId(),
            immediateAmount);
      }
    }
    return specialTotal;
  }

  /**
   * Chooses the direct owner for this usage. Treating their own allocated
   * visits wins; otherwise the earliest owner bucket with enough visits is
   * used and the treating PT is handled as a substitute.
   */
  public UsageSplit assignUsage(long patientCourseId, long treatingEmployeeId, int quantity) {
    List<Map<String, Object>> rows =
        db.queryForList(
            "SELECT id,employee_id,commission_status FROM course_commission_splits WHERE"
                + " patient_course_id=? AND commission_status<>'CANCELLED'"
                + " AND allocated_visits-used_visits-refunded_visits>=?"
                + " ORDER BY CASE WHEN employee_id=? THEN 0"
                + " ELSE 1 END,split_order FOR UPDATE",
            patientCourseId,
            quantity,
            treatingEmployeeId);
    if (rows.isEmpty()) {
      Integer splitCount = db.queryForObject(
          "SELECT count(*) FROM course_commission_splits WHERE patient_course_id=?",
          Integer.class,
          patientCourseId);
      if (splitCount == null || splitCount == 0) return null; // untouched historical course
      throw new IllegalArgumentException(
          "No commission-owner split has enough visits remaining for this usage");
    }
    Map<String, Object> row = rows.get(0);
    long splitId = ((Number) row.get("id")).longValue();
    db.update(
        "UPDATE course_commission_splits SET used_visits=used_visits+? WHERE id=?",
        quantity,
        splitId);
    return new UsageSplit(
        splitId,
        ((Number) row.get("employee_id")).longValue(),
        (String) row.get("commission_status"));
  }

  private static BigDecimal specialTotal(String type, BigDecimal value, BigDecimal fullCredit) {
    if (type == null || value == null)
      throw new IllegalArgumentException("Special commission type and value are required");
    return "PERCENTAGE".equals(type)
        ? fullCredit.multiply(value).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP)
        : money(value);
  }

  private static BigDecimal money(BigDecimal value) {
    return value.setScale(2, RoundingMode.HALF_UP);
  }
}
