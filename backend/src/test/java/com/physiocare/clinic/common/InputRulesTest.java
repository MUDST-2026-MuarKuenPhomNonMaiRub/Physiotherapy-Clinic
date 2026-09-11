package com.physiocare.clinic.common;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import org.junit.jupiter.api.Test;

class InputRulesTest {
  @Test
  void requireAcceptsTrueAndRejectsFalse() {
    assertDoesNotThrow(() -> InputRules.require(true, "should pass"));
    assertThrows(IllegalArgumentException.class, () -> InputRules.require(false, "should fail"));
  }

  @Test
  void moneyAcceptsNullZeroAndTwoDecimalPlaces() {
    assertDoesNotThrow(() -> InputRules.money(null, "Price"));
    assertDoesNotThrow(() -> InputRules.money(new BigDecimal("0"), "Price"));
    assertDoesNotThrow(() -> InputRules.money(new BigDecimal("1000000.00"), "Price"));
    assertDoesNotThrow(() -> InputRules.money(new BigDecimal("12.34"), "Price"));
  }

  @Test
  void moneyRejectsNegativeTooLargeAndOverPreciseValues() {
    assertThrows(IllegalArgumentException.class, () -> InputRules.money(new BigDecimal("-0.01"), "Price"));
    assertThrows(IllegalArgumentException.class, () -> InputRules.money(new BigDecimal("1000000.01"), "Price"));
    assertThrows(IllegalArgumentException.class, () -> InputRules.money(new BigDecimal("12.345"), "Price"));
  }

  @Test
  void oneOfAcceptsAllowedValueAndRejectsNullOrUnknownValue() {
    assertDoesNotThrow(() -> InputRules.oneOf("CASH", List.of("CASH", "QR"), "Payment method"));
    assertThrows(IllegalArgumentException.class, () -> InputRules.oneOf(null, List.of("CASH"), "Payment method"));
    assertThrows(IllegalArgumentException.class, () -> InputRules.oneOf("CARD", List.of("CASH"), "Payment method"));
  }

  @Test
  void inRangeAcceptsBothBoundsAndRejectsOutsideValues() {
    assertDoesNotThrow(() -> InputRules.inRange(1, 1, 10, "Duration"));
    assertDoesNotThrow(() -> InputRules.inRange(10, 1, 10, "Duration"));
    assertThrows(IllegalArgumentException.class, () -> InputRules.inRange(0, 1, 10, "Duration"));
    assertThrows(IllegalArgumentException.class, () -> InputRules.inRange(11, 1, 10, "Duration"));
  }

  @Test
  void birthDateAcceptsNullTodayAndPlausibleDate() {
    LocalDate today = LocalDate.now();
    assertDoesNotThrow(() -> InputRules.birthDate(null));
    assertDoesNotThrow(() -> InputRules.birthDate(today));
    assertDoesNotThrow(() -> InputRules.birthDate(today.minusYears(129)));
  }

  @Test
  void birthDateRejectsFutureAndImplausiblyOldDate() {
    LocalDate today = LocalDate.now();
    assertThrows(IllegalArgumentException.class, () -> InputRules.birthDate(today.plusDays(1)));
    assertThrows(IllegalArgumentException.class, () -> InputRules.birthDate(today.minusYears(130)));
  }

  @Test
  void nationalIdAcceptsBlankAndExactlyThirteenDigits() {
    assertDoesNotThrow(() -> InputRules.nationalId(null));
    assertDoesNotThrow(() -> InputRules.nationalId(""));
    assertDoesNotThrow(() -> InputRules.nationalId(" 1234567890123 "));
  }

  @Test
  void nationalIdRejectsWrongLengthAndNonDigits() {
    assertThrows(IllegalArgumentException.class, () -> InputRules.nationalId("123456789012"));
    assertThrows(IllegalArgumentException.class, () -> InputRules.nationalId("12345678901234"));
    assertThrows(IllegalArgumentException.class, () -> InputRules.nationalId("123456789012A"));
  }

  @Test
  void passportAcceptsBlankAndFiveToTwentyAlphanumericCharacters() {
    assertDoesNotThrow(() -> InputRules.passport(null));
    assertDoesNotThrow(() -> InputRules.passport(""));
    assertDoesNotThrow(() -> InputRules.passport(" A1234 "));
    assertDoesNotThrow(() -> InputRules.passport("A1234567890123456789"));
  }

  @Test
  void passportRejectsShortLongAndSpecialCharacterValues() {
    assertThrows(IllegalArgumentException.class, () -> InputRules.passport("A123"));
    assertThrows(IllegalArgumentException.class, () -> InputRules.passport("A12345678901234567890"));
    assertThrows(IllegalArgumentException.class, () -> InputRules.passport("A-1234"));
  }

  @Test
  void phoneAcceptsExactlyTenDigits() {
    assertDoesNotThrow(() -> InputRules.phone("0812345678"));
    assertDoesNotThrow(() -> InputRules.phone(" 0812345678 "));
  }

  @Test
  void phoneRejectsBlankWrongLengthFormattedAndNonDigitValues() {
    assertThrows(IllegalArgumentException.class, () -> InputRules.phone(null));
    assertThrows(IllegalArgumentException.class, () -> InputRules.phone(""));
    assertThrows(IllegalArgumentException.class, () -> InputRules.phone("081234567"));
    assertThrows(IllegalArgumentException.class, () -> InputRules.phone("08123456789"));
    assertThrows(IllegalArgumentException.class, () -> InputRules.phone("081-234-5678"));
    assertThrows(IllegalArgumentException.class, () -> InputRules.phone("abcdefghij"));
  }

  @Test
  void emailAcceptsBlankAndBasicValidAddress() {
    assertDoesNotThrow(() -> InputRules.email(null));
    assertDoesNotThrow(() -> InputRules.email(""));
    assertDoesNotThrow(() -> InputRules.email("staff@example.com"));
    assertDoesNotThrow(() -> InputRules.email(" staff@example.co.th "));
  }

  @Test
  void emailRejectsMissingPartsWhitespaceAndMultipleAtSigns() {
    assertThrows(IllegalArgumentException.class, () -> InputRules.email("staff"));
    assertThrows(IllegalArgumentException.class, () -> InputRules.email("staff@example"));
    assertThrows(IllegalArgumentException.class, () -> InputRules.email("staff @example.com"));
    assertThrows(IllegalArgumentException.class, () -> InputRules.email("staff@@example.com"));
  }

  @Test
  void bookingWindowAcceptsTodayAndUpToTwoYearsAheadInCallerOffset() {
    ZoneOffset offset = ZoneOffset.ofHours(7);
    OffsetDateTime now = OffsetDateTime.now(offset);
    assertDoesNotThrow(() -> InputRules.bookingWindow(now));
    assertDoesNotThrow(() -> InputRules.bookingWindow(now.plusYears(2)));
  }

  @Test
  void bookingWindowRejectsPastAndMoreThanTwoYearsAhead() {
    ZoneOffset offset = ZoneOffset.ofHours(7);
    OffsetDateTime now = OffsetDateTime.now(offset);
    assertThrows(IllegalArgumentException.class, () -> InputRules.bookingWindow(now.minusDays(1)));
    assertThrows(IllegalArgumentException.class, () -> InputRules.bookingWindow(now.plusYears(2).plusDays(1)));
  }

  @Test
  void thaiTextAcceptsThaiCharactersAndRejectsBlankOrNonThaiText() {
    assertDoesNotThrow(() -> InputRules.thaiText("นายสมชาย ใจดี", "Name"));
    assertDoesNotThrow(() -> InputRules.thaiText("  สมชาย  ", "Name"));
    assertThrows(IllegalArgumentException.class, () -> InputRules.thaiText(null, "Name"));
    assertThrows(IllegalArgumentException.class, () -> InputRules.thaiText("", "Name"));
    assertThrows(IllegalArgumentException.class, () -> InputRules.thaiText("Somchai", "Name"));
    assertThrows(IllegalArgumentException.class, () -> InputRules.thaiText("สมชาย123", "Name"));
  }

  @Test
  void textAcceptsNullAndTextAtMaximumLength() {
    assertDoesNotThrow(() -> InputRules.text(null, 5, "Nickname"));
    assertDoesNotThrow(() -> InputRules.text("12345", 5, "Nickname"));
    assertThrows(IllegalArgumentException.class, () -> InputRules.text("123456", 5, "Nickname"));
  }
}
