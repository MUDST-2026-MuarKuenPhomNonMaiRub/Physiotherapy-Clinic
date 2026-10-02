package com.physiocare.clinic.dto.catalog;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import java.math.BigDecimal;

public final class CatalogDtos {
  private CatalogDtos() {}

  public record ServiceRequest(
      String code,
      @NotBlank String nameTh,
      String nameEn,
      @NotBlank String serviceType,
      @Positive int durationMinutes,
      @NotNull @DecimalMin("0") BigDecimal basePrice,
      Boolean active) {}

  public record CourseRequest(
      String code,
      @NotBlank String nameTh,
      String nameEn,
      String description,
      @Positive int totalSessions,
      @PositiveOrZero int bonusSessions,
      @Positive Integer validityDays,
      @NotNull @DecimalMin("0") BigDecimal price,
      Boolean active,
      String commissionMode,
      String specialCommissionType,
      BigDecimal specialCommissionValue) {
    public CourseRequest(
        String code,
        String nameTh,
        String nameEn,
        String description,
        int totalSessions,
        int bonusSessions,
        Integer validityDays,
        BigDecimal price,
        Boolean active) {
      this(
          code,
          nameTh,
          nameEn,
          description,
          totalSessions,
          bonusSessions,
          validityDays,
          price,
          active,
          null,
          null,
          null);
    }
  }

  public record MasterDataRequest(
      @NotBlank String dataType, @NotBlank String nameTh, String nameEn, Boolean active) {}

  public record ActiveRequest(boolean active) {}
}
