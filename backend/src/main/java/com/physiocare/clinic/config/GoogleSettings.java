package com.physiocare.clinic.config;

import java.util.Arrays;
import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/** The OAuth client the clinic registered with Google, or nothing — in which case the feature is off. */
@Component
public class GoogleSettings {
  private final String clientId;
  private final String clientSecret;
  private final String redirectUri;
  private final String frontendUrl;
  private final List<Integer> reminderMinutes;

  /** For tests and callers that take the default reminders. */
  public GoogleSettings(String clientId, String clientSecret, String redirectUri, String frontendUrl) {
    this(clientId, clientSecret, redirectUri, frontendUrl, DEFAULT_REMINDERS);
  }

  @Autowired
  public GoogleSettings(
      @Value("${app.google.client-id:}") String clientId,
      @Value("${app.google.client-secret:}") String clientSecret,
      @Value("${app.google.redirect-uri:}") String redirectUri,
      @Value("${app.frontend-url:http://localhost:3000}") String frontendUrl,
      @Value("${app.google.reminder-minutes:" + DEFAULT_REMINDERS + "}") String reminderMinutes) {
    this.clientId = clientId == null ? "" : clientId.trim();
    this.clientSecret = clientSecret == null ? "" : clientSecret.trim();
    this.redirectUri = redirectUri == null ? "" : redirectUri.trim();
    this.frontendUrl = stripTrailingSlash(frontendUrl == null ? "" : frontendUrl.trim());
    this.reminderMinutes = parseReminders(reminderMinutes);
  }

  /** A popup half an hour ahead to get moving, and one at ten minutes. */
  static final String DEFAULT_REMINDERS = "30,10";
  /** Google takes at most five overrides, each up to four weeks ahead. */
  private static final int MAX_REMINDERS = 5;
  private static final int MAX_REMINDER_MINUTES = 40320;

  /**
   * "30,10" → [30, 10]. Blank means "use the therapist's own Google default".
   * A value Google would reject is dropped rather than failing every push.
   */
  public static List<Integer> parseReminders(String value) {
    if (value == null || value.isBlank()) return List.of();
    return Arrays.stream(value.split(","))
        .map(String::trim)
        .filter(part -> part.matches("\\d{1,5}"))
        .map(Integer::valueOf)
        .filter(minutes -> minutes <= MAX_REMINDER_MINUTES)
        .distinct()
        .limit(MAX_REMINDERS)
        .toList();
  }

  /** Popup reminders before each event; empty to leave reminders to Google's default. */
  public List<Integer> reminderMinutes() {
    return reminderMinutes;
  }

  public boolean configured() {
    return !clientId.isBlank() && !clientSecret.isBlank() && !redirectUri.isBlank();
  }

  public String clientId() {
    return clientId;
  }

  public String clientSecret() {
    return clientSecret;
  }

  public String redirectUri() {
    return redirectUri;
  }

  public String frontendUrl() {
    return frontendUrl;
  }

  private static String stripTrailingSlash(String value) {
    return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
  }
}
