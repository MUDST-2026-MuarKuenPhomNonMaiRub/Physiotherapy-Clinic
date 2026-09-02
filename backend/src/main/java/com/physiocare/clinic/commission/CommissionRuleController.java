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
 * Line-level commission rules the counter applies when a receipt is written.
 * Separate from {@link CommissionSettingsController}, which configures the
 * monthly course-pool scheme.
 */
@RestController
@RequestMapping("/api/v1/commission-rules")
public class CommissionRuleController {
  private final JdbcTemplate db;

  public CommissionRuleController(JdbcTemplate db) {
    this.db = db;
  }

  public record RuleRequest(
      @NotBlank String name,
      @NotBlank String appliesTo,
      @NotBlank String targetType,
      Long targetServiceId,
      Long targetCourseId,
      @NotBlank String commissionType,
      @NotNull @DecimalMin("0") BigDecimal value,
      @NotNull LocalDate effectiveDate,
      Boolean active) {}

  public record ActiveRequest(boolean active) {}

  @GetMapping
  public List<Map<String, Object>> list() {
    return db.queryForList(
        "SELECT"
            + " id,name,applies_to,target_type,target_service_id,target_course_id,commission_type,value,effective_date,active"
            + " FROM commission_rules ORDER BY id");
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  @PreAuthorize("hasRole('ADMIN')")
  public Map<String, Object> create(@Valid @RequestBody RuleRequest r) {
    validate(r);
    long id =
        db.queryForObject(
            "INSERT INTO"
                + " commission_rules(name,applies_to,target_type,target_service_id,target_course_id,commission_type,value,effective_date,active)"
                + " VALUES(?,?,?,?,?,?,?,?,?) RETURNING id",
            Long.class,
            r.name(),
            r.appliesTo(),
            r.targetType(),
            "SERVICE".equals(r.targetType()) ? r.targetServiceId() : null,
            "COURSE".equals(r.targetType()) ? r.targetCourseId() : null,
            r.commissionType(),
            r.value(),
            r.effectiveDate(),
            r.active() == null || r.active());
    return rule(id);
  }

  @PatchMapping("/{id}")
  @PreAuthorize("hasRole('ADMIN')")
  public Map<String, Object> update(@PathVariable long id, @Valid @RequestBody RuleRequest r) {
    validate(r);
    int rows =
        db.update(
            "UPDATE commission_rules SET"
                + " name=?,applies_to=?,target_type=?,target_service_id=?,target_course_id=?,commission_type=?,value=?,effective_date=?,active=COALESCE(?,active),updated_at=now()"
                + " WHERE id=?",
            r.name(),
            r.appliesTo(),
            r.targetType(),
            "SERVICE".equals(r.targetType()) ? r.targetServiceId() : null,
            "COURSE".equals(r.targetType()) ? r.targetCourseId() : null,
            r.commissionType(),
            r.value(),
            r.effectiveDate(),
            r.active(),
            id);
    if (rows == 0) throw new IllegalArgumentException("Commission rule not found");
    return rule(id);
  }

  @PatchMapping("/{id}/status")
  @PreAuthorize("hasRole('ADMIN')")
  public Map<String, Object> setStatus(@PathVariable long id, @RequestBody ActiveRequest r) {
    int rows = db.update("UPDATE commission_rules SET active=?,updated_at=now() WHERE id=?", r.active(), id);
    if (rows == 0) throw new IllegalArgumentException("Commission rule not found");
    return rule(id);
  }

  private Map<String, Object> rule(long id) {
    return db.queryForMap(
        "SELECT"
            + " id,name,applies_to,target_type,target_service_id,target_course_id,commission_type,value,effective_date,active"
            + " FROM commission_rules WHERE id=?",
        id);
  }

  private void validate(RuleRequest r) {
    if (!List.of("TREATMENT", "SALES", "BOTH").contains(r.appliesTo()))
      throw new IllegalArgumentException("appliesTo must be TREATMENT, SALES or BOTH");
    if (!List.of("SERVICE", "COURSE", "ALL").contains(r.targetType()))
      throw new IllegalArgumentException("targetType must be SERVICE, COURSE or ALL");
    if (!List.of("PERCENTAGE", "FIXED").contains(r.commissionType()))
      throw new IllegalArgumentException("commissionType must be PERCENTAGE or FIXED");
    if ("PERCENTAGE".equals(r.commissionType()) && r.value().compareTo(new BigDecimal("100")) > 0)
      throw new IllegalArgumentException("A percentage commission cannot exceed 100");
  }
}
