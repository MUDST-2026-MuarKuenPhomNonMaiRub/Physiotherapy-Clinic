package com.physiocare.clinic.dto.commission;

import java.math.BigDecimal;

public final class CommissionReportDtos {
  private CommissionReportDtos() {}

  public record ReportRow(
      long staffId,
      String staffName,
      BigDecimal monthlyCourseSales,
      BigDecimal commissionGenerated,
      BigDecimal specialImmediateCommission,
      BigDecimal grossAllocated,
      BigDecimal ownerNetReleased,
      BigDecimal treatmentFeeEarned,
      BigDecimal adjustments,
      BigDecimal outstandingPool,
      BigDecimal totalVariablePay) {}
}
