package com.physiocare.clinic.googlecalendar.model;

import java.time.OffsetDateTime;

/** Request and response bodies of the Google Calendar API endpoints. */
public final class GoogleCalendarDtos {
  private GoogleCalendarDtos() {}

  /** Where the browser should go to give consent. */
  public record ConnectResponse(String authorizationUrl) {}

  /**
   * The signed-in person's own connection.
   *
   * @param enabled whether the clinic has configured the integration at all
   * @param staffLinked false for an account with no staff profile, which has no
   *     appointments of its own to sync
   */
  public record ConnectionStatusResponse(
      boolean enabled,
      boolean staffLinked,
      boolean connected,
      String googleEmail,
      String status,
      OffsetDateTime connectedAt,
      String lastError) {}

  /** One staff member on the admin overview. */
  public record StaffConnectionResponse(
      long staffId,
      String staffName,
      String position,
      boolean connected,
      String googleEmail,
      String status,
      OffsetDateTime connectedAt,
      String lastError) {}

  /** The outcome of a manual retry. */
  public record SyncResultResponse(
      long appointmentId, String status, OffsetDateTime syncedAt, String error) {}
}
