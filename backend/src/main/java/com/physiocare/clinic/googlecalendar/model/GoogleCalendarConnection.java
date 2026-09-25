package com.physiocare.clinic.googlecalendar.model;

import java.time.OffsetDateTime;

/** One row of google_calendar_connections. The refresh token stays encrypted here. */
public record GoogleCalendarConnection(
    long id,
    long staffId,
    String googleEmail,
    String refreshTokenCiphertext,
    String calendarId,
    ConnectionStatus status,
    String lastError,
    OffsetDateTime connectedAt) {

  public boolean isActive() {
    return status == ConnectionStatus.ACTIVE;
  }
}
