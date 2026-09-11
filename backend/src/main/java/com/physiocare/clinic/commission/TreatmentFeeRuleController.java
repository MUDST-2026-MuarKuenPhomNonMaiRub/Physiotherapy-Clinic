package com.physiocare.clinic.commission;

import com.physiocare.clinic.common.CurrentUser;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
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
  private final CommissionAuditService audit;
  private final CurrentUser currentUser;

  public TreatmentFeeRuleController(
      JdbcTemplate db, CommissionAuditService audit, CurrentUser currentUser) {
    this.db = db;
    this.audit = audit;
    this.currentUser = currentUser;
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
  public Map<String, Object> create(@Valid @RequestBody RuleRequest r, Authentication authentication) {
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
    Map<String, Object> created = rule(id);
    audit.record(currentUser.id(authentication), null, "TREATMENT_FEE_RULE_CREATED",
        "treatment_fee_rules", String.valueOf(id), null, created, "New treatment fee rule");
    return created;
  }

  @PatchMapping("/{id}")
  @PreAuthorize("hasRole('ADMIN')")
  public Map<String, Object> update(
      @PathVariable long id, @Valid @RequestBody RuleRequest r, Authentication authentication) {
    validate(r);
    Map<String, Object> before = rule(id);
    int rows = db.update(
        "UPDATE treatment_fee_rules SET employee_id=?,employee_group=?,service_id=?,fee_type=?,"
            + "fee_value=?,percentage_base=?,effective_from=?,effective_to=?,active=COALESCE(?,active),"
            + "version=version+1 WHERE id=?",
        r.employeeId(), r.employeeGroup(), r.serviceId(), r.feeType(), r.feeValue(),
        "FIXED".equals(r.feeType()) ? null : r.percentageBase(), r.effectiveFrom(), r.effectiveTo(),
        r.active(), id);
    if (rows == 0) throw new IllegalArgumentException("Treatment fee rule not found");
    Map<String, Object> after = rule(id);
    audit.record(currentUser.id(authentication), null, "TREATMENT_FEE_RULE_UPDATED",
        "treatment_fee_rules", String.valueOf(id), before, after, "Treatment fee rule updated");
    return after;
  }

  @PatchMapping("/{id}/status")
  @PreAuthorize("hasRole('ADMIN')")
  public Map<String, Object> setStatus(
      @PathVariable long id, @RequestBody Map<String, Boolean> body, Authentication authentication) {
    Boolean active = body.get("active");
    Map<String, Object> before = rule(id);
    int rows = db.update("UPDATE treatment_fee_rules SET active=? WHERE id=?", active, id);
    if (rows == 0) throw new IllegalArgumentException("Treatment fee rule not found");
    Map<String, Object> after = rule(id);
    audit.record(currentUser.id(authentication), null, "TREATMENT_FEE_RULE_STATUS_CHANGED",
        "treatment_fee_rules", String.valueOf(id), before, after, "Treatment fee rule status changed");
    return after;
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
    if ("PERCENTAGE".equals(r.feeType())
        && (r.percentageBase() == null || r.percentageBase().isBlank()))
      throw new IllegalArgumentException("A percentage treatment fee needs a calculation base");
    if (r.effectiveTo() != null && r.effectiveTo().isBefore(r.effectiveFrom()))
      throw new IllegalArgumentException("Effective To must not be before Effective From");
    if (r.employeeId() != null && r.employeeGroup() != null)
      throw new IllegalArgumentException("Set either an employee or an employee group, not both");
  }
}
