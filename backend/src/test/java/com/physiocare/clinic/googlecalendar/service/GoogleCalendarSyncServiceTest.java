package com.physiocare.clinic.googlecalendar.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

import com.physiocare.clinic.appointment.AppointmentChangedEvent;
import com.physiocare.clinic.common.BranchAccessService;
import com.physiocare.clinic.googlecalendar.client.GoogleApiException;
import com.physiocare.clinic.googlecalendar.client.GoogleCalendarApiClient;
import com.physiocare.clinic.googlecalendar.config.GoogleCalendarProperties;
import com.physiocare.clinic.googlecalendar.model.AppointmentSyncSnapshot;
import com.physiocare.clinic.googlecalendar.model.ConnectionStatus;
import com.physiocare.clinic.googlecalendar.model.GoogleCalendarConnection;
import com.physiocare.clinic.googlecalendar.model.GoogleSyncStatus;
import com.physiocare.clinic.googlecalendar.repository.AppointmentSyncRepository;
import java.time.OffsetDateTime;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class GoogleCalendarSyncServiceTest {
  private static final long APPOINTMENT = 42L;
  private static final long PHYSIO = 7L;
  private static final GoogleCalendarProperties ON =
      new GoogleCalendarProperties(true, "client", "secret", "http://cb", "http://app", 10);
  private static final GoogleCalendarConnection ACTIVE = new GoogleCalendarConnection(
      1, PHYSIO, "physio@gmail.com", "cipher", "primary", ConnectionStatus.ACTIVE, null, OffsetDateTime.now());

  private AppointmentSyncRepository appointments;
  private GoogleCalendarConnectionService connections;
  private GoogleCalendarApiClient calendar;
  private GoogleCalendarSyncService service;

  @BeforeEach
  void setUp() {
    appointments = mock(AppointmentSyncRepository.class);
    connections = mock(GoogleCalendarConnectionService.class);
    calendar = mock(GoogleCalendarApiClient.class);
    service = serviceWith(ON);
    when(connections.accessTokenFor(any())).thenReturn("access-token");
  }

  private GoogleCalendarSyncService serviceWith(GoogleCalendarProperties properties) {
    return new GoogleCalendarSyncService(properties, appointments, connections, calendar,
        new CalendarEventFactory("Asia/Bangkok"), mock(BranchAccessService.class));
  }

  private static AppointmentSyncSnapshot appointment(String status, String eventId, GoogleSyncStatus sync) {
    OffsetDateTime start = OffsetDateTime.parse("2026-10-01T03:00:00Z");
    return new AppointmentSyncSnapshot(APPOINTMENT, "AP-2026-00042", status, PHYSIO, start,
        start.plusHours(1), "HN000123", "เอ", "Office Syndrome", "Silom", "Room 1", eventId, sync);
  }

  private void given(AppointmentSyncSnapshot snapshot) {
    when(appointments.findSnapshot(APPOINTMENT)).thenReturn(Optional.of(snapshot));
  }

  @Test
  void newBookingIsQueuedWhenThePhysiotherapistIsConnected() {
    given(appointment("CONFIRMED", null, null));
    when(connections.findConnection(PHYSIO)).thenReturn(Optional.of(ACTIVE));

    service.prepare(AppointmentChangedEvent.created(APPOINTMENT));

    verify(appointments).markPending(APPOINTMENT, false);
    verifyNoInteractions(calendar);
  }

  @Test
  void newBookingIsSkippedWhenThePhysiotherapistHasNoCalendar() {
    given(appointment("CONFIRMED", null, null));
    when(connections.findConnection(PHYSIO)).thenReturn(Optional.empty());

    service.prepare(AppointmentChangedEvent.created(APPOINTMENT));

    verify(appointments).markSkipped(APPOINTMENT, GoogleCalendarSyncService.NOT_CONNECTED);
  }

  @Test
  void nothingHappensWhileTheIntegrationIsSwitchedOff() {
    GoogleCalendarSyncService off = serviceWith(
        new GoogleCalendarProperties(false, "", "", "http://cb", "http://app", 10));

    off.prepare(AppointmentChangedEvent.created(APPOINTMENT));
    off.sync(APPOINTMENT);

    verifyNoInteractions(appointments, calendar);
  }

  @Test
  void rescheduleHandsTheEventToTheNewBooking() {
    long newId = 43L;
    when(appointments.findSnapshot(newId)).thenReturn(Optional.empty());

    service.prepare(AppointmentChangedEvent.rescheduled(APPOINTMENT, newId));

    verify(appointments).transferEvent(APPOINTMENT, newId);
  }

  @Test
  void pendingBookingIsInsertedUnderAnIdSavedBeforehand() {
    given(appointment("CONFIRMED", null, GoogleSyncStatus.PENDING));
    when(connections.findConnection(PHYSIO)).thenReturn(Optional.of(ACTIVE));

    service.sync(APPOINTMENT);

    ArgumentCaptor<String> eventId = ArgumentCaptor.forClass(String.class);
    var order = inOrder(appointments, calendar);
    order.verify(appointments).assignEventId(eq(APPOINTMENT), eventId.capture());
    order.verify(calendar).insertEvent(eq("access-token"), eq("primary"), eq(eventId.getValue()), any());
    order.verify(appointments).markSynced(APPOINTMENT, eventId.getValue());
    assertThat(eventId.getValue()).matches("[0-9a-v]{5,1024}");
  }

  @Test
  void existingEventIsPatchedInPlace() {
    given(appointment("CONFIRMED", "pcexisting", GoogleSyncStatus.PENDING));
    when(connections.findConnection(PHYSIO)).thenReturn(Optional.of(ACTIVE));

    service.sync(APPOINTMENT);

    verify(calendar).patchEvent(eq("access-token"), eq("primary"), eq("pcexisting"), any());
    verify(calendar, never()).insertEvent(anyString(), anyString(), anyString(), any());
    verify(appointments).markSynced(APPOINTMENT, "pcexisting");
  }

  @Test
  void eventMissingInGoogleIsCreatedAgain() {
    given(appointment("CONFIRMED", "pcgone", GoogleSyncStatus.FAILED));
    when(connections.findConnection(PHYSIO)).thenReturn(Optional.of(ACTIVE));
    doThrow(new GoogleApiException(404, null, "Not Found"))
        .when(calendar).patchEvent(anyString(), anyString(), eq("pcgone"), any());

    service.sync(APPOINTMENT);

    verify(calendar).insertEvent(eq("access-token"), eq("primary"), anyString(), any());
    verify(appointments).markSynced(eq(APPOINTMENT), argThat(id -> !id.equals("pcgone")));
  }

  @Test
  void cancelledBookingDeletesItsEvent() {
    given(appointment("CANCELLED", "pcevent", GoogleSyncStatus.PENDING));
    when(connections.findConnection(PHYSIO)).thenReturn(Optional.of(ACTIVE));

    service.sync(APPOINTMENT);

    verify(calendar).deleteEvent("access-token", "primary", "pcevent");
    verify(appointments).markRemoved(APPOINTMENT);
  }

  @Test
  void eventAlreadyDeletedInGoogleCountsAsRemoved() {
    given(appointment("NO_SHOW", "pcevent", GoogleSyncStatus.PENDING));
    when(connections.findConnection(PHYSIO)).thenReturn(Optional.of(ACTIVE));
    doThrow(new GoogleApiException(410, null, "Resource has been deleted"))
        .when(calendar).deleteEvent(anyString(), anyString(), anyString());

    service.sync(APPOINTMENT);

    verify(appointments).markRemoved(APPOINTMENT);
  }

  @Test
  void googleFailureIsRecordedNotThrown() {
    given(appointment("CONFIRMED", null, GoogleSyncStatus.PENDING));
    when(connections.findConnection(PHYSIO)).thenReturn(Optional.of(ACTIVE));
    doThrow(new GoogleApiException(503, null, "Backend Error"))
        .when(calendar).insertEvent(anyString(), anyString(), anyString(), any());

    service.sync(APPOINTMENT);

    verify(appointments).markFailed(APPOINTMENT, "Google Calendar: Backend Error");
    verify(appointments, never()).markSynced(anyLong(), anyString());
  }

  @Test
  void revokedAccessAsksThePhysiotherapistToReconnect() {
    given(appointment("CONFIRMED", null, GoogleSyncStatus.PENDING));
    when(connections.findConnection(PHYSIO)).thenReturn(Optional.of(ACTIVE));
    when(connections.accessTokenFor(ACTIVE))
        .thenThrow(new GoogleApiException(400, "invalid_grant", "Token has been expired or revoked."));

    service.sync(APPOINTMENT);

    verify(connections).markReauthRequired(PHYSIO);
    verify(appointments).markFailed(APPOINTMENT, GoogleCalendarConnectionService.REAUTH_MESSAGE);
  }

  @Test
  void rejectedOAuthClientIsReportedAsAServerSettingNotAnExpiredGrant() {
    given(appointment("CONFIRMED", null, GoogleSyncStatus.PENDING));
    when(connections.findConnection(PHYSIO)).thenReturn(Optional.of(ACTIVE));
    when(connections.accessTokenFor(ACTIVE))
        .thenThrow(new GoogleApiException(401, "invalid_client", "The OAuth client was not found."));

    service.sync(APPOINTMENT);

    verify(connections, never()).markReauthRequired(anyLong());
    verify(appointments).markFailed(eq(APPOINTMENT), contains("GOOGLE_OAUTH_CLIENT_ID"));
  }

  @Test
  void settledRowsAreLeftAlone() {
    given(appointment("CONFIRMED", "pcevent", GoogleSyncStatus.SYNCED));

    service.sync(APPOINTMENT);

    verifyNoInteractions(calendar);
    verify(appointments, never()).recordAttempt(anyLong());
  }
}
