package com.physiocare.clinic.integration.google;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.physiocare.clinic.commission.AbstractCommissionIntegrationTest;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

/**
 * The push against a stand-in Google: what is queued, what is sent, and what
 * happens when Google says no. Runs on the same throwaway PostgreSQL as the
 * commission suite.
 */
@TestPropertySource(
    properties = {
      "app.google.client-id=test-client",
      "app.google.client-secret=test-secret",
      "app.google.redirect-uri=http://localhost:8080/api/v1/integrations/google/callback",
      "app.frontend-url=http://clinic.test"
    })
class GoogleCalendarSyncTest extends AbstractCommissionIntegrationTest {
  @MockitoBean private GoogleApiClient google;
  @Autowired private GoogleCalendarConnectionService connections;
  @Autowired private GoogleCalendarSyncService sync;

  private long connect(long staffId) {
    long userId = seedActorUserId();
    when(google.exchangeCode("the-code")).thenReturn(new GoogleApiClient.Tokens("access-1", "refresh-1", 3600));
    when(google.email("access-1")).thenReturn("dr@example.com");
    String url = connections.authorizationUrl(staffId, userId);
    Matcher state = Pattern.compile("state=([A-Za-z0-9_-]+)").matcher(url);
    assertThat(state.find()).isTrue();
    assertThat(connections.completeConnection(state.group(1), "the-code")).isEqualTo(staffId);
    return userId;
  }

  private long seedAppointment(long staffId, long patientId, String status) {
    long id = nextId();
    long serviceId = db.queryForObject("SELECT id FROM services ORDER BY id LIMIT 1", Long.class);
    db.update(
        "INSERT INTO appointments(id,appointment_no,patient_id,branch_id,provider_staff_id,service_id,"
            + "starts_at,ends_at,status) VALUES(?,?,?,1,?,?,'2026-10-01 09:00:00+07','2026-10-01 09:45:00+07',?)",
        id, "AP-G-" + id, patientId, staffId, serviceId, status);
    return id;
  }

  @Test
  void connectionStoresTheRefreshTokenEncryptedAndShowsTheAccount() {
    long staffId = seedStaff("Dr Google");
    connect(staffId);

    Map<String, Object> row =
        db.queryForMap("SELECT google_email,refresh_token_ciphertext FROM staff_google_calendars WHERE staff_id=?", staffId);
    assertThat(row.get("google_email")).isEqualTo("dr@example.com");
    assertThat((String) row.get("refresh_token_ciphertext")).isNotEqualTo("refresh-1").isNotBlank();
    assertThat(connections.status(staffId).connected()).isTrue();
    assertThat(connections.connection(staffId).orElseThrow().refreshToken()).isEqualTo("refresh-1");
    // The one-time state cannot be replayed.
    assertThat(db.queryForObject("SELECT count(*) FROM google_oauth_states WHERE staff_id=?", Long.class, staffId)).isZero();
  }

  @Test
  void aBookingReachesGoogleWithoutThePatientsFullNameOrPhone() {
    long staffId = seedStaff("Dr Push");
    long patientId = seedPatient("Somchai");
    db.update("UPDATE patients SET nickname='น้องเจ' WHERE id=?", patientId);
    connect(staffId);
    long appointmentId = seedAppointment(staffId, patientId, "CONFIRMED");

    sync.appointmentChanged(appointmentId);
    assertThat(db.queryForObject(
        "SELECT sync_status FROM appointment_calendar_events WHERE appointment_id=?", String.class, appointmentId))
        .isEqualTo("PENDING");

    sync.processDue();

    @SuppressWarnings("unchecked")
    ArgumentCaptor<Map<String, Object>> event = ArgumentCaptor.forClass(Map.class);
    verify(google).insertEvent(eq("access-1"), eq("primary"), event.capture());
    Map<String, Object> sent = event.getValue();
    assertThat(sent.get("id")).isEqualTo("labalance" + appointmentId);
    assertThat((String) sent.get("summary")).startsWith("น้องเจ · ");
    String description = (String) sent.get("description");
    assertThat(description).contains("HN" + patientId).contains("http://clinic.test/appointments/" + appointmentId);
    assertThat(description).doesNotContain("Somchai").doesNotContain("080" + patientId);
    @SuppressWarnings("unchecked")
    Map<String, Object> start = (Map<String, Object>) sent.get("start");
    assertThat(start.get("timeZone")).isEqualTo("Asia/Bangkok");
    assertThat((String) start.get("dateTime")).startsWith("2026-10-01T09:00");

    Map<String, Object> row = db.queryForMap(
        "SELECT sync_status,google_event_id FROM appointment_calendar_events WHERE appointment_id=?", appointmentId);
    assertThat(row.get("sync_status")).isEqualTo("SYNCED");
    assertThat(row.get("google_event_id")).isEqualTo("labalance" + appointmentId);
  }

  @Test
  void cancellingRemovesTheEventAndAnUnconnectedTherapistQueuesNothing() {
    long connected = seedStaff("Dr Connected");
    long unconnected = seedStaff("Dr Offline");
    long patientId = seedPatient("Anyone");
    connect(connected);

    long theirs = seedAppointment(unconnected, patientId, "CONFIRMED");
    sync.appointmentChanged(theirs);
    assertThat(db.queryForObject(
        "SELECT count(*) FROM appointment_calendar_events WHERE appointment_id=?", Long.class, theirs)).isZero();

    long mine = seedAppointment(connected, patientId, "CONFIRMED");
    sync.appointmentChanged(mine);
    sync.processDue();
    db.update("UPDATE appointments SET status='CANCELLED' WHERE id=?", mine);
    sync.appointmentChanged(mine);
    sync.processDue();

    verify(google).deleteEvent("access-1", "primary", "labalance" + mine);
    assertThat(db.queryForObject(
        "SELECT sync_status FROM appointment_calendar_events WHERE appointment_id=?", String.class, mine))
        .isEqualTo("DELETED");
  }

  @Test
  void anEventThatAlreadyExistsIsUpdatedInstead() {
    long staffId = seedStaff("Dr Twice");
    long patientId = seedPatient("Repeat");
    connect(staffId);
    long appointmentId = seedAppointment(staffId, patientId, "COMPLETED");
    doThrow(new GoogleApiClient.GoogleApiException(409, "exists"))
        .when(google).insertEvent(anyString(), anyString(), any());

    sync.appointmentChanged(appointmentId);
    sync.processDue();

    verify(google).updateEvent(eq("access-1"), eq("primary"), eq("labalance" + appointmentId), any());
    assertThat(db.queryForObject(
        "SELECT sync_status FROM appointment_calendar_events WHERE appointment_id=?", String.class, appointmentId))
        .isEqualTo("SYNCED");
  }

  @Test
  void aGoogleOutageLeavesTheRowFailedWithABackoffAndTheErrorOnTheConnection() {
    long staffId = seedStaff("Dr Outage");
    long patientId = seedPatient("Waiting");
    connect(staffId);
    long appointmentId = seedAppointment(staffId, patientId, "CONFIRMED");
    doThrow(new GoogleApiClient.GoogleApiException(503, "Google answered 503"))
        .when(google).insertEvent(anyString(), anyString(), any());

    sync.appointmentChanged(appointmentId);
    sync.processDue();

    Map<String, Object> row = db.queryForMap(
        "SELECT sync_status,attempts,last_error,next_attempt_at>now() AS deferred FROM appointment_calendar_events"
            + " WHERE appointment_id=?", appointmentId);
    assertThat(row.get("sync_status")).isEqualTo("FAILED");
    assertThat(((Number) row.get("attempts")).intValue()).isEqualTo(1);
    assertThat((String) row.get("last_error")).contains("503");
    assertThat(row.get("deferred")).isEqualTo(true);
    assertThat(connections.status(staffId).lastError()).contains("503");

    // Not due yet, so a sweep leaves it alone; a manual retry puts it back.
    sync.processDue();
    verify(google, never()).updateEvent(anyString(), anyString(), anyString(), any());
    sync.retry(appointmentId);
    assertThat(db.queryForObject(
        "SELECT sync_status FROM appointment_calendar_events WHERE appointment_id=?", String.class, appointmentId))
        .isEqualTo("PENDING");
  }

  @Test
  void disconnectingRemovesEveryEventAndTheGrant() {
    long staffId = seedStaff("Dr Leaving");
    long patientId = seedPatient("Left behind");
    connect(staffId);
    long a = seedAppointment(staffId, patientId, "CONFIRMED");
    sync.appointmentChanged(a);
    sync.processDue();

    sync.disconnect(staffId, null, "test");

    verify(google).deleteEvent("access-1", "primary", "labalance" + a);
    verify(google).revoke("refresh-1");
    assertThat(connections.status(staffId).connected()).isFalse();
    List<Map<String, Object>> rows = db.queryForList(
        "SELECT 1 FROM appointment_calendar_events WHERE staff_id=?", staffId);
    assertThat(rows).isEmpty();
  }

  @Test
  void connectingBackfillsUpcomingAppointmentsOnly() {
    long staffId = seedStaff("Dr Backfill");
    long patientId = seedPatient("Old and new");
    long upcoming = seedAppointment(staffId, patientId, "CONFIRMED");
    long cancelled = seedAppointment(staffId, patientId, "CANCELLED");
    long past = nextId();
    long serviceId = db.queryForObject("SELECT id FROM services ORDER BY id LIMIT 1", Long.class);
    db.update(
        "INSERT INTO appointments(id,appointment_no,patient_id,branch_id,provider_staff_id,service_id,"
            + "starts_at,ends_at,status) VALUES(?,?,?,1,?,?,'2025-01-01 09:00:00+07','2025-01-01 09:45:00+07','COMPLETED')",
        past, "AP-G-" + past, patientId, staffId, serviceId);
    connect(staffId);

    assertThat(sync.backfill(staffId)).isEqualTo(1);
    List<Long> queued = db.queryForList(
        "SELECT appointment_id FROM appointment_calendar_events WHERE staff_id=?", Long.class, staffId);
    assertThat(queued).containsExactly(upcoming).doesNotContain(cancelled, past);
  }
}
