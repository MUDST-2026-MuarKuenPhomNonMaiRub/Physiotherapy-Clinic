package com.physiocare.clinic.checkout;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/** Records immediate commission created by a paid single-visit service. */
@Service
public class CheckoutCommissionService {
  private final JdbcTemplate db;

  public CheckoutCommissionService(JdbcTemplate db) {
    this.db = db;
  }

  /**
   * Finds the most specific active rule and records its snapshot on the receipt.
   * Course-pool commission is intentionally handled by the course allocation flow.
   */
  public void record(
      long transactionId,
      String appliesTo,
      String targetType,
      Long targetId,
      long staffId,
      BigDecimal base,
      LocalDate on) {
    String targetColumn = "SERVICE".equals(targetType) ? "target_service_id" : "target_course_id";
    List<Map<String, Object>> rules =
        db.queryForList(
            "SELECT id,name,commission_type,value FROM commission_rules WHERE active AND"
                + " effective_date<=? AND (applies_to=? OR applies_to='BOTH') AND ("
                + "  (target_type=? AND "
                + targetColumn
                + "=?)"
                + "  OR (target_type=? AND "
                + targetColumn
                + " IS NULL)"
                + "  OR target_type='ALL')"
                + " ORDER BY CASE WHEN target_type=? AND "
                + targetColumn
                + "=? THEN 0"
                + "               WHEN target_type=? THEN 1 ELSE 2 END, effective_date DESC, id"
                + " LIMIT 1",
            on,
            appliesTo,
            targetType,
            targetId,
            targetType,
            targetType,
            targetId,
            targetType);
    if (rules.isEmpty()) return;

    Map<String, Object> rule = rules.get(0);
    BigDecimal value = (BigDecimal) rule.get("value");
    BigDecimal amount =
        "PERCENTAGE".equals(rule.get("commission_type"))
            ? base.multiply(value).divide(new BigDecimal("100"), 0, RoundingMode.HALF_UP)
            : value;
    db.update(
        "INSERT INTO transaction_commissions(sales_transaction_id,commission_rule_id,"
            + "rule_name_snapshot,staff_id,commission_type,amount) VALUES(?,?,?,?,?,?)",
        transactionId,
        rule.get("id"),
        rule.get("name"),
        staffId,
        appliesTo,
        amount);
  }
}
