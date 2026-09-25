package com.physiocare.clinic.googlecalendar.model;

import java.time.OffsetDateTime;

/**
 * What the sync needs to know about one appointment. Patient details are
 * limited to the HN and a short name on purpose: the event leaves the clinic's
 * systems, so phone numbers, surnames and notes are never read here.
 *
 * @param patientShortName the nickname, or the Thai first name when there is none
 */
public record AppointmentSyncSnapshot(
    long appointmentId,
    String appointmentNo,
    String status,
    long providerStaffId,
    OffsetDateTime startsAt,
    OffsetDateTime endsAt,
    String hn,
    String patientShortName,
    String serviceName,
    String branchName,
    String roomName,
    String googleEventId,
    GoogleSyncStatus syncStatus) {

  public boolean isCancelled() {
    return "CANCELLED".equals(status) || "NO_SHOW".equals(status);
  }

  public boolean isRescheduled() {
    return "RESCHEDULED".equals(status);
  }

  /** Only a row waiting or failed has work left; anything else is already settled. */
  public boolean needsSync() {
    return syncStatus == GoogleSyncStatus.PENDING || syncStatus == GoogleSyncStatus.FAILED;
  }
}
