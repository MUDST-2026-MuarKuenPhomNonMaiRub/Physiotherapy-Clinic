package com.physiocare.clinic.checkout;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import org.junit.jupiter.api.Test;

class CheckoutPricingTest {
  @Test
  void computesTotalsAndDiscountRatioFromCatalogLines() {
    CheckoutPricing pricing = CheckoutPricing.calculate(
        new BigDecimal("100.00"), new BigDecimal("50.00"),
        java.util.List.of(
            new CheckoutDtos.Adjustment("discount", new BigDecimal("-15.00")),
            new CheckoutDtos.Adjustment("fee", new BigDecimal("5.00"))));

    assertThat(pricing.grossTotal()).isEqualByComparingTo("150.00");
    assertThat(pricing.netTotal()).isEqualByComparingTo("140.00");
    assertThat(pricing.discountRatio()).isEqualByComparingTo("0.90");
  }
}
