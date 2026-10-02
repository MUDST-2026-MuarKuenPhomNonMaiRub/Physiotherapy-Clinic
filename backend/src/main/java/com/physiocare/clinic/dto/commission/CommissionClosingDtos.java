package com.physiocare.clinic.dto.commission;

import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.YearMonth;

public final class CommissionClosingDtos {
  private CommissionClosingDtos() {}

  public record CloseRequest(@NotNull YearMonth month, boolean earlyClose, String reason) {}

  public record OverrideRequest(@NotNull BigDecimal newRate, String reason) {}

  public record EmployeePreview(
      long employeeId,
      String employeeName,
      BigDecimal monthlySales,
      Long schemeId,
      Integer schemeVersion,
      BigDecimal suggestedRate,
      BigDecimal suggestedPool,
      boolean alreadyClosed) {}
}
