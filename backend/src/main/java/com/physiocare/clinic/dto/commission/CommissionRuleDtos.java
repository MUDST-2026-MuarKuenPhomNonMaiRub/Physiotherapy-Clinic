package com.physiocare.clinic.dto.commission;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;

public final class CommissionRuleDtos {
  private CommissionRuleDtos() {}

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
}
