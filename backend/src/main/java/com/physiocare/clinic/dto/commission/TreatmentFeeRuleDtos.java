package com.physiocare.clinic.dto.commission;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;

public final class TreatmentFeeRuleDtos {
  private TreatmentFeeRuleDtos() {}

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
}
