package com.physiocare.clinic.checkout;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.math.BigDecimal;
import org.junit.jupiter.api.Test;

class CheckoutIntegrityTest {
  @Test
  void acceptsOnlyCatalogPriceOrNoClientOverride() {
    assertDoesNotThrow(() -> CheckoutService.requireCatalogPrice(null, new BigDecimal("100.00"), "service"));
    assertDoesNotThrow(() -> CheckoutService.requireCatalogPrice(new BigDecimal("100.00"), new BigDecimal("100.00"), "service"));
  }

  @Test
  void rejectsClientPriceOverrideThatDiffersFromCatalog() {
    assertThrows(IllegalArgumentException.class,
        () -> CheckoutService.requireCatalogPrice(new BigDecimal("99.99"), new BigDecimal("100.00"), "service"));
  }
}
