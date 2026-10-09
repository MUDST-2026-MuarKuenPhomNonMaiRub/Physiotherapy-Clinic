package com.physiocare.clinic.dto.catalog;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public final class CatalogConfigurationDtos {
  private CatalogConfigurationDtos() {}

  public record PaymentRequest(
      @NotBlank @Size(max = 120) String name, @NotBlank String icon, boolean enabled) {}

  public record CategoryRequest(
      @NotBlank @Size(max = 120) String name, @Size(max = 300) String description) {}
}
