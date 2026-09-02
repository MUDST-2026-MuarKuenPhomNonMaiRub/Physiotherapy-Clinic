package com.physiocare.clinic.commission;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;

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

  public record CloseMonthRequest(@NotNull YearMonth month) {}

  public record UseCourseRequest(
      @Positive long visitId,
      @Positive long patientId,
      @Positive long treatingEmployeeId,
      @NotNull LocalDate visitDate,
      Long treatmentFeeRuleId) {}

  public record TransferRequest(
      @Positive long toPatientId, @Positive int quantity, @NotBlank String reason) {}

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

  public record ClosingView(
      YearMonth month, long employeeId, BigDecimal monthlySales, BigDecimal rate, String status) {}
}
