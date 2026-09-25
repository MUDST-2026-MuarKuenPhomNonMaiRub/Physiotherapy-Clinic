package com.physiocare.clinic.integration.google.model;

/**
 * One due row of the appointment_calendar_events outbox.
 *
 * @param pendingAction UPSERT to write the event, DELETE to remove it
 */
public record CalendarOutboxEntry(
    long appointmentId, long staffId, String pendingAction, String googleEventId, int attempts) {

  public boolean isDelete() {
    return "DELETE".equals(pendingAction);
  }
}
