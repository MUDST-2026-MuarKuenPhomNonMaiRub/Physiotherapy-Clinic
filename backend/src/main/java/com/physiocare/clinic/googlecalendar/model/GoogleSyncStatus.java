package com.physiocare.clinic.googlecalendar.model;

/** Where an appointment stands with its provider's Google Calendar. */
public enum GoogleSyncStatus {
  /** Waiting for the background sync to reach Google. */
  PENDING,
  /** The event in Google matches the appointment. */
  SYNCED,
  /** The last attempt failed; the retry job or a manual retry will try again. */
  FAILED,
  /** Nothing to sync — the physiotherapist has not connected a calendar. */
  SKIPPED,
  /** The appointment was cancelled or a no-show and its event was deleted. */
  REMOVED,
  /** Rescheduled: the event now belongs to the replacement booking. */
  MOVED
}
