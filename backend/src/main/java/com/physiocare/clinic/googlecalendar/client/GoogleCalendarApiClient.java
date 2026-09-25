package com.physiocare.clinic.googlecalendar.client;

import com.physiocare.clinic.googlecalendar.model.CalendarEvent;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/** Google Calendar API v3, limited to the three event calls the sync needs. */
@Component
public class GoogleCalendarApiClient {
  private static final String EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars/{calendarId}/events";
  private static final String EVENT_URL = EVENTS_URL + "/{eventId}";

  private final RestClient http;
  private final GoogleErrorDecoder errors = new GoogleErrorDecoder();

  public GoogleCalendarApiClient(RestClient googleRestClient) {
    this.http = googleRestClient;
  }

  /** Creates the event under an id chosen by the caller, so a retried insert cannot duplicate it. */
  public void insertEvent(String accessToken, String calendarId, String eventId, CalendarEvent event) {
    Map<String, Object> body = toJson(event);
    body.put("id", eventId);
    http.post()
        .uri(EVENTS_URL, calendarId)
        .headers(h -> h.setBearerAuth(accessToken))
        .contentType(MediaType.APPLICATION_JSON)
        .body(body)
        .retrieve()
        .onStatus(HttpStatusCode::isError, errors)
        .toBodilessEntity();
  }

  /**
   * Overwrites the fields the clinic owns. Status is sent as "confirmed" so an
   * event someone deleted by hand in Google comes back instead of staying hidden.
   */
  public void patchEvent(String accessToken, String calendarId, String eventId, CalendarEvent event) {
    http.patch()
        .uri(EVENT_URL, calendarId, eventId)
        .headers(h -> h.setBearerAuth(accessToken))
        .contentType(MediaType.APPLICATION_JSON)
        .body(toJson(event))
        .retrieve()
        .onStatus(HttpStatusCode::isError, errors)
        .toBodilessEntity();
  }

  public void deleteEvent(String accessToken, String calendarId, String eventId) {
    http.delete()
        .uri(EVENT_URL, calendarId, eventId)
        .headers(h -> h.setBearerAuth(accessToken))
        .retrieve()
        .onStatus(HttpStatusCode::isError, errors)
        .toBodilessEntity();
  }

  private static Map<String, Object> toJson(CalendarEvent event) {
    Map<String, Object> body = new LinkedHashMap<>();
    body.put("summary", event.summary());
    body.put("description", event.description());
    body.put("location", event.location());
    body.put("status", "confirmed");
    body.put("start", Map.of(
        "dateTime", event.start().format(DateTimeFormatter.ISO_OFFSET_DATE_TIME),
        "timeZone", event.timeZone()));
    body.put("end", Map.of(
        "dateTime", event.end().format(DateTimeFormatter.ISO_OFFSET_DATE_TIME),
        "timeZone", event.timeZone()));
    body.put("extendedProperties", Map.of(
        "private", Map.of("physiocareAppointmentId", String.valueOf(event.appointmentId()))));
    return body;
  }
}
