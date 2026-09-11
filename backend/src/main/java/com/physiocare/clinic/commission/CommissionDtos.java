package com.physiocare.clinic.commission;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDate;

public final class CommissionDtos {
  private CommissionDtos() {}

  public record CreateCourseRequest(
      @NotBlank String courseId,
      @NotBlank String receiptNo,
      @Positive long salesTransactionId,
      @Positive long patientId,
      @Positive long packageId,
      @Positive long sellerEmployeeId,
      @Positive long caseOwnerEmployeeId,
      @NotNull @DecimalMin("0.00") BigDecimal coursePrice,
      @Positive int totalVisits,
      @NotNull LocalDate saleDate) {}

  public record CourseView(
      String courseId,
      String receiptNo,
      String status,
      int totalVisits,
      int visitsUsed,
      int remainingVisits,
      BigDecimal lockedRate,
      BigDecimal commissionPool,
      BigDecimal allocationPerVisit,
      BigDecimal grossAllocated,
      BigDecimal treatmentFeeTotal,
      BigDecimal ownerNet,
      BigDecimal outstanding) {}
}
