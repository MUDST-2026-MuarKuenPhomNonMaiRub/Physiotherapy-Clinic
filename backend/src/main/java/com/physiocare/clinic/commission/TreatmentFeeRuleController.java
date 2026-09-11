package com.physiocare.clinic.commission;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

/**
 * The Substitute Treatment Fee configuration a treating PT (who is not the
 * case owner) is paid from the visit's commission allocation — see
 * {@link TreatmentFeeResolver} for how a visit picks one of these.
 */
@RestController
@RequestMapping("/api/v1/treatment-fee-rules")
public class TreatmentFeeRuleController {
  private final JdbcTemplate db;

  public TreatmentFeeRuleController(JdbcTemplate db) {
    this.db = db;
  }

  public record RuleRequest(
      Long employeeId,
      String employeeGroup,
      Long serviceId,
      @NotBlank String feeType,
      @NotNull @DecimalMin("0") BigDecimal feeValue,
      String percentageBase,
      @NotNull LocalDate effectiveFrom,
      LocalDate effectiveTo,
      Boolean active) {}

  @GetMapping
  @PreAuthorize("isAuthenticated()")
  public List<Map<String, Object>> list() {
    return db.queryForList(
        "SELECT id,version,employee_id,employee_group,service_id,fee_type,fee_value,"
            + "percentage_base,effective_from,effective_to,active FROM treatment_fee_rules ORDER BY"
            + " id DESC");
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  @PreAuthorize("hasRole('ADMIN')")
  public Map<String, Object> create(@Valid @RequestBody RuleRequest r) {
    validate(r);
    long id =
        db.queryForObject(
            "INSERT INTO treatment_fee_rules(version,employee_id,employee_group,service_id,"
                + "fee_type,fee_value,percentage_base,effective_from,effective_to,active) VALUES"
                + "(1,?,?,?,?,?,?,?,?,?) RETURNING id",
            Long.class,
            r.employeeId(),
            r.employeeGroup(),
            r.serviceId(),
            r.feeType(),
            r.feeValue(),
            "FIXED".equals(r.feeType()) ? null : r.percentageBase(),
            r.effectiveFrom(),
            r.effectiveTo(),
            r.active() == null || r.active());
    return rule(id);
  }

  @PatchMapping("/{id}/status")
  @PreAuthorize("hasRole('ADMIN')")
  public Map<String, Object> setStatus(@PathVariable long id, @RequestBody Map<String, Boolean> body) {
    Boolean active = body.get("active");
    int rows = db.update("UPDATE treatment_fee_rules SET active=? WHERE id=?", active, id);
    if (rows == 0) throw new IllegalArgumentException("Treatment fee rule not found");
    return rule(id);
  }

  private Map<String, Object> rule(long id) {
    return db.queryForMap(
        "SELECT id,version,employee_id,employee_group,service_id,fee_type,fee_value,"
            + "percentage_base,effective_from,effective_to,active FROM treatment_fee_rules WHERE"
            + " id=?",
        id);
  }

  private void validate(RuleRequest r) {
    if (!List.of("FIXED", "PERCENTAGE").contains(r.feeType()))
      throw new IllegalArgumentException("feeType must be FIXED or PERCENTAGE");
    if ("PERCENTAGE".equals(r.feeType()) && r.feeValue().compareTo(new BigDecimal("100")) > 0)
      throw new IllegalArgumentException("A percentage treatment fee cannot exceed 100");
    if (r.employeeId() != null && r.employeeGroup() != null)
      throw new IllegalArgumentException("Set either an employee or an employee group, not both");
  }
}
