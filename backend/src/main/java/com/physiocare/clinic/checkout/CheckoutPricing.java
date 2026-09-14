package com.physiocare.clinic.checkout;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

/** Pure pricing calculation for a checkout; database and validation stay in the use-case. */
record CheckoutPricing(
    BigDecimal grossTotal,
    BigDecimal adjustmentTotal,
    BigDecimal discountTotal,
    BigDecimal netTotal,
    BigDecimal discountRatio) {
  static CheckoutPricing calculate(
      BigDecimal servicePrice, BigDecimal coursePrice, List<CheckoutDtos.Adjustment> adjustments) {
    BigDecimal gross = servicePrice.add(coursePrice);
    BigDecimal adjustmentTotal = adjustments.stream()
        .map(CheckoutDtos.Adjustment::amount)
        .reduce(BigDecimal.ZERO, BigDecimal::add);
    BigDecimal discountTotal = adjustments.stream()
        .map(CheckoutDtos.Adjustment::amount)
        .filter(amount -> amount.signum() < 0)
        .reduce(BigDecimal.ZERO, BigDecimal::add);
    BigDecimal net = gross.add(adjustmentTotal);
    BigDecimal ratio = gross.signum() > 0
        ? gross.add(discountTotal).max(BigDecimal.ZERO).divide(gross, 10, RoundingMode.HALF_UP)
        : BigDecimal.ONE;
    return new CheckoutPricing(gross, adjustmentTotal, discountTotal, net, ratio);
  }
}
