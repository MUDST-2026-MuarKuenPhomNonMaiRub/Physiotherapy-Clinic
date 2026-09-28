package com.physiocare.clinic.checkout;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.util.List;

public final class CheckoutDtos {
  private CheckoutDtos() {}

  /** A manual discount (negative) or extra charge (positive) applied to the whole bill. */
  public record Adjustment(@NotBlank String label, @NotNull BigDecimal amount) {}

  /** Full-price sales credit and visit ownership assigned when a course is sold. */
  public record CourseCommissionSplit(
      @Positive long employeeId,
      @NotNull @DecimalMin(value = "0.01") BigDecimal salesCreditAmount,
      @Positive int visits) {}

  public record CheckoutRequest(
      @Positive long patientId,
      @Positive long branchId,
      Long appointmentId,
      Long serviceId,
      Long purchaseCourseId,
      Long usePatientCourseId,
      Integer useSessionsCount,
      boolean useNewlyPurchasedSession,
      Long treatingStaffId,
      Long salespersonId,
      @Positive long paymentMethodId,
      String paymentReferenceNo,
      /** Cash handed over. Required when the method is cash, ignored otherwise. */
      BigDecimal cashReceived,
      BigDecimal servicePrice,
      BigDecimal coursePurchasePrice,
      List<Adjustment> adjustments,
      Long caseOwnerEmployeeId,
      List<CourseCommissionSplit> commissionSplits) {
    /** Backward-compatible constructor: salesperson remains the course owner when no separate owner is sent. */
    public CheckoutRequest(
        long patientId, long branchId, Long appointmentId, Long serviceId, Long purchaseCourseId,
        Long usePatientCourseId, Integer useSessionsCount, boolean useNewlyPurchasedSession,
        Long treatingStaffId, Long salespersonId, long paymentMethodId, String paymentReferenceNo,
        BigDecimal cashReceived, BigDecimal servicePrice, BigDecimal coursePurchasePrice,
        List<Adjustment> adjustments) {
      this(patientId, branchId, appointmentId, serviceId, purchaseCourseId, usePatientCourseId,
          useSessionsCount, useNewlyPurchasedSession, treatingStaffId, salespersonId, paymentMethodId,
          paymentReferenceNo, cashReceived, servicePrice, coursePurchasePrice, adjustments, null, null);
    }

    /** Backward-compatible constructor for clients that send one case owner. */
    public CheckoutRequest(
        long patientId, long branchId, Long appointmentId, Long serviceId, Long purchaseCourseId,
        Long usePatientCourseId, Integer useSessionsCount, boolean useNewlyPurchasedSession,
        Long treatingStaffId, Long salespersonId, long paymentMethodId, String paymentReferenceNo,
        BigDecimal cashReceived, BigDecimal servicePrice, BigDecimal coursePurchasePrice,
        List<Adjustment> adjustments, Long caseOwnerEmployeeId) {
      this(patientId, branchId, appointmentId, serviceId, purchaseCourseId, usePatientCourseId,
          useSessionsCount, useNewlyPurchasedSession, treatingStaffId, salespersonId, paymentMethodId,
          paymentReferenceNo, cashReceived, servicePrice, coursePurchasePrice, adjustments,
          caseOwnerEmployeeId, null);
    }
  }

  public record VoidRequest(@NotBlank String reason) {}

  public record LineItem(String description, int qty, BigDecimal amount, String kind) {}

  public record CourseImpact(String label, int quantity) {}

  public record CommissionLine(
      Long ruleId, String ruleName, Long staffId, String type, BigDecimal amount) {}

  public record VoidInfo(String voidBy, String voidAt, String reason) {}

  public record TransactionView(
      long id,
      String transactionNo,
      String date,
      long patientId,
      long branchId,
      Long appointmentId,
      String type,
      List<LineItem> items,
      BigDecimal subtotal,
      BigDecimal total,
      Long paymentMethodId,
      BigDecimal cashReceived,
      BigDecimal changeGiven,
      Long treatingStaffId,
      Long salespersonId,
      String status,
      List<CourseImpact> courseImpact,
      List<CommissionLine> commission,
      Long patientCourseId,
      VoidInfo voidInfo) {}
}
