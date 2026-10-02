package com.physiocare.clinic.dto.commission;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public final class CommissionSettingsDtos {
  private CommissionSettingsDtos() {}

  public record Tier(
      @Positive int order,
      @NotNull @DecimalMin("0") BigDecimal min,
      BigDecimal max,
      @NotNull @DecimalMin("0") @DecimalMax("1") BigDecimal rate) {}

  public record Scheme(
      @NotBlank String code,
      @NotNull LocalDate effectiveFrom,
      LocalDate effectiveTo,
      @NotEmpty List<@Valid Tier> tiers) {}
}
