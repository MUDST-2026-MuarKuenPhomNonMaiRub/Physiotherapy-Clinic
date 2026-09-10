package com.physiocare.clinic.common;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * Checks that the clinic's own rules place on incoming values, beyond the
 * shape-level annotations on the request records.
 *
 * <p>They live on the server because that is the only place a rule actually
 * holds: the forms repeat some of these for a quicker answer, but anything
 * reaching the API directly still has to pass here.
 */
public final class InputRules {
  private InputRules() {}

  /** Above this a figure is a typo rather than a price. */
  public static final BigDecimal MAX_MONEY = new BigDecimal("1000000");

  /** A treatment lasting longer than a working day is a mistake. */
  public static final int MAX_DURATION_MINUTES = 8 * 60;

  /** A course covering more than a year of daily visits is a mistake. */
  public static final int MAX_SESSIONS = 365;

  private static final int MAX_PAST_YEARS = 1;
  private static final int MAX_FUTURE_YEARS = 2;

  public static void require(boolean condition, String message) {
    if (!condition) throw new IllegalArgumentException(message);
  }

  /** Rejects a negative amount, a typo-sized one, and sub-satang precision. */
  public static void money(BigDecimal amount, String label) {
    if (amount == null) return;
    require(amount.signum() >= 0, label + " cannot be negative");
    require(amount.compareTo(MAX_MONEY) <= 0, label + " looks too large — the most is " + MAX_MONEY);
    require(amount.scale() <= 2, label + " cannot have more than two decimal places");
  }

  public static void oneOf(String value, List<String> allowed, String label) {
    require(value != null && allowed.contains(value), label + " must be one of " + allowed);
  }

  public static void inRange(int value, int min, int max, String label) {
    require(value >= min && value <= max, label + " must be between " + min + " and " + max);
  }

  /** A date of birth cannot be ahead of today, nor older than any living person. */
  public static void birthDate(LocalDate value) {
    if (value == null) return;
    LocalDate today = LocalDate.now();
    require(!value.isAfter(today), "A date of birth cannot be in the future");
    require(value.isAfter(today.minusYears(130)), "That date of birth is not plausible");
  }

  /**
   * Thai national ID as the registration form collects it: thirteen digits.
   * The check digit is deliberately not verified, so that records carried over
   * from paper stay editable.
   */
  public static void nationalId(String value) {
    if (isBlank(value)) return;
    require(value.trim().matches("\\d{13}"), "A Thai national ID has exactly 13 digits");
  }

  public static void passport(String value) {
    if (isBlank(value)) return;
    require(
        value.trim().matches("[A-Za-z0-9]{5,20}"),
        "A passport number is 5 to 20 letters or digits");
  }

  /** Digits plus the punctuation people write phone numbers with. */
  public static void phone(String value) {
    require(!isBlank(value), "A phone number is required");
    String trimmed = value.trim();
    require(
        trimmed.matches("[0-9+\\-() ]{6,25}"),
        "A phone number can only contain digits and + - ( ) spaces");
    require(
        trimmed.replaceAll("[^0-9]", "").length() >= 6,
        "That phone number does not have enough digits");
  }

  public static void email(String value) {
    if (isBlank(value)) return;
    require(
        value.trim().matches("[^@\\s]+@[^@\\s]+\\.[^@\\s]+"), "That email address is not valid");
  }

  /** Keeps a booking inside the window a clinic could plausibly be working in. */
  public static void bookingWindow(LocalDate startDate) {
    LocalDate today = LocalDate.now();
    require(
        !startDate.isBefore(today.minusYears(MAX_PAST_YEARS)),
        "That date is too far in the past to book");
    require(
        !startDate.isAfter(today.plusYears(MAX_FUTURE_YEARS)),
        "That date is too far in the future to book");
  }

  public static void text(String value, int max, String label) {
    if (value == null) return;
    require(value.length() <= max, label + " cannot be longer than " + max + " characters");
  }

  private static boolean isBlank(String value) {
    return value == null || value.isBlank();
  }
}
