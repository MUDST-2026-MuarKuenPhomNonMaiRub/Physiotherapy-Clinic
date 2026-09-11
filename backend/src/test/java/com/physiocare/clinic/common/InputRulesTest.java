package com.physiocare.clinic.common;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;

class InputRulesTest {
  @Test
  void acceptsExactlyTenPhoneDigits() {
    assertDoesNotThrow(() -> InputRules.phone("0812345678"));
  }

  @Test
  void rejectsPhoneNumbersThatAreNotExactlyTenDigits() {
    assertThrows(IllegalArgumentException.class, () -> InputRules.phone("081234567"));
    assertThrows(IllegalArgumentException.class, () -> InputRules.phone("08123456789"));
    assertThrows(IllegalArgumentException.class, () -> InputRules.phone("081-234-5678"));
    assertThrows(IllegalArgumentException.class, () -> InputRules.phone("abcdefghij"));
  }
}
