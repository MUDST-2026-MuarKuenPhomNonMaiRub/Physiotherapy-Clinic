package com.physiocare.clinic.checkout;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.util.List;

public final class CheckoutDtos {
  private CheckoutDtos() {}

  /** A manual discount (negative) or extra charge (positive) applied to the whole bill. */
  public record Adjustment(@NotBlank String label, @NotNull BigDecimal amount) {}

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
      BigDecimal servicePrice,
      BigDecimal coursePurchasePrice,
      List<Adjustment> adjustments) {}

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
      Long treatingStaffId,
      Long salespersonId,
      String status,
      List<CourseImpact> courseImpact,
      List<CommissionLine> commission,
      Long patientCourseId,
      VoidInfo voidInfo) {}
}
