package com.physiocare.clinic.integration.google.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.OffsetDateTime;

/**
 * Response bodies of the Google Calendar endpoints. Field names match what the
 * frontend already reads, including the snake_case ones.
 */
public final class GoogleCalendarDtos {
  private GoogleCalendarDtos() {}

  /** The signed-in person's (or, for an admin, any staff member's) link. */
  public record StatusResponse(
      long staffId,
      boolean configured,
      boolean connected,
      String googleEmail,
      String connectedAt,
      String lastError,
      String lastErrorAt,
      int pending) {}

  /** Google's consent page for the browser to open. */
  public record ConnectResponse(String url) {}

  /** One connected staff member on the administration screens. */
  public record ConnectionRow(
      @JsonProperty("staff_id") long staffId,
      @JsonProperty("staff_name") String staffName,
      @JsonProperty("position") String position,
      @JsonProperty("google_email") String googleEmail,
      @JsonProperty("connected_at") OffsetDateTime connectedAt,
      @JsonProperty("last_error") String lastError,
      @JsonProperty("last_error_at") OffsetDateTime lastErrorAt,
      @JsonProperty("pending") int pending) {}

  /** Where one appointment stands in its therapist's calendar. */
  public record SyncStatusResponse(
      @JsonProperty("sync_status") String syncStatus,
      @JsonProperty("pending_action") String pendingAction,
      @JsonProperty("attempts") int attempts,
      @JsonProperty("last_error") String lastError,
      @JsonProperty("updated_at") OffsetDateTime updatedAt) {}
}
