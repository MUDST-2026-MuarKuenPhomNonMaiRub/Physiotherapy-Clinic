package com.physiocare.clinic.commission;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/**
 * Decides whether a visit owes a Substitute Treatment Fee, and if so, which
 * rule prices it. The server is the only one that gets to make this call —
 * a client never supplies a rule id or asserts who is treating.
 */
@Service
public class TreatmentFeeResolver {
  private final JdbcTemplate db;

  public TreatmentFeeResolver(JdbcTemplate db) {
    this.db = db;
  }

  public record Resolution(
      long ruleId, String feeType, BigDecimal feeValue, String percentageBase) {}

  /**
   * Empty when the treating PT is the case owner (no substitute fee applies —
   * checked first, before any rule lookup) or when no rule covers this
   * employee/service on this date.
   */
  public Optional<Resolution> resolve(
      long treatingEmployeeId, long caseOwnerEmployeeId, Long serviceId, LocalDate visitDate) {
    if (treatingEmployeeId == caseOwnerEmployeeId) return Optional.empty();

    String staffType =
        db.queryForList("SELECT staff_type FROM staff WHERE id=?", String.class, treatingEmployeeId)
            .stream()
            .findFirst()
            .orElse(null);

    List<Map<String, Object>> candidates =
        db.queryForList(
            "SELECT id,employee_id,employee_group,service_id,fee_type,fee_value,percentage_base"
                + " FROM treatment_fee_rules WHERE active AND effective_from<=? AND"
                + " (effective_to IS NULL OR effective_to>=?) AND (employee_id IS NULL OR"
                + " employee_id=?) AND (employee_group IS NULL OR employee_group=?) AND"
                + " (service_id IS NULL OR service_id=?)",
            visitDate,
            visitDate,
            treatingEmployeeId,
            staffType,
            serviceId);

    return candidates.stream()
        .min(Comparator.comparingInt(this::specificity))
        .map(
            row ->
                new Resolution(
                    ((Number) row.get("id")).longValue(),
                    (String) row.get("fee_type"),
                    (BigDecimal) row.get("fee_value"),
                    (String) row.get("percentage_base")));
  }

  /** Lower is more specific: employee+service beats employee alone, beats group, beats a global default. */
  private int specificity(Map<String, Object> rule) {
    boolean employee = rule.get("employee_id") != null;
    boolean group = rule.get("employee_group") != null;
    boolean service = rule.get("service_id") != null;
    if (employee && service) return 0;
    if (employee) return 1;
    if (group && service) return 2;
    if (group) return 3;
    if (service) return 4;
    return 5;
  }
}
