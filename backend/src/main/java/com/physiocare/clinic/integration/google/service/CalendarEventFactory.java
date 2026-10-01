package com.physiocare.clinic.integration.google.service;

import com.physiocare.clinic.integration.google.config.GoogleSettings;
import com.physiocare.clinic.integration.google.model.AppointmentEventSource;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

/**
 * What the therapist sees in Google: who (nickname, else HN — never the full
 * name or phone, since this lives in their personal account), what, where,
 * and a link back into the system for everything else.
 */
@Component
public class CalendarEventFactory {
  private static final DateTimeFormatter TIME = DateTimeFormatter.ofPattern("HH:mm");
  /**
   * RFC 3339 with seconds always present. {@code OffsetDateTime.toString()}
   * drops ":00" seconds ("10:00+07:00"), which Google rejects as 400 Bad Request.
   */
  private static final DateTimeFormatter RFC_3339 = DateTimeFormatter.ISO_OFFSET_DATE_TIME;

  private final GoogleSettings settings;

  public CalendarEventFactory(GoogleSettings settings) {
    this.settings = settings;
  }

  /**
   * A deterministic Google event id per appointment (base32hex: a-v, 0-9),
   * so a retried insert lands on the same event instead of a duplicate.
   */
  public static String eventId(long appointmentId) {
    return "labalance" + appointmentId;
  }

  /**
   * Google's fixed event palette, so the day reads at a glance: green once the
   * visit is done, orange while the patient is in, purple for an assessment
   * still to come and the brand cyan for any other booked visit.
   */
  static String colorId(AppointmentEventSource a) {
    return switch (a.status()) {
      case "COMPLETED" -> "10"; // Basil
      case "ARRIVED", "IN_SERVICE" -> "6"; // Tangerine
      default -> "ASSESSMENT".equals(a.serviceType()) ? "3" /* Grape */ : "7" /* Peacock */;
    };
  }

  public Map<String, Object> build(AppointmentEventSource a) {
    String zone = a.timezone() == null ? "Asia/Bangkok" : a.timezone();
    OffsetDateTime starts = a.startsAt().atZone(ZoneId.of(zone)).toOffsetDateTime();
    OffsetDateTime ends = a.endsAt().atZone(ZoneId.of(zone)).toOffsetDateTime();
    String who = a.nickname() != null && !a.nickname().isBlank() ? a.nickname() : "HN " + a.hn();
    String summary = ("COMPLETED".equals(a.status()) ? "✓ " : "") + who + " · " + a.serviceName();

    StringBuilder description = new StringBuilder();
    description.append("HN ").append(a.hn()).append('\n');
    description.append("Service: ").append(a.serviceName()).append('\n');
    if (a.roomName() != null) description.append("Room: ").append(a.roomName()).append('\n');
    description.append("Branch: ").append(a.branchName()).append('\n');
    description.append("Time: ").append(TIME.format(starts)).append('–').append(TIME.format(ends)).append('\n');
    description.append("Status: ").append(a.status()).append('\n');
    description.append("Appointment ").append(a.appointmentNo()).append('\n');
    description.append('\n').append("Open in LA BALANCE: ")
        .append(settings.frontendUrl()).append("/appointments/").append(a.appointmentId());

    Map<String, Object> event = new LinkedHashMap<>();
    event.put("id", eventId(a.appointmentId()));
    event.put("summary", summary);
    event.put("description", description.toString());
    if (a.branchAddress() != null) event.put("location", a.branchAddress());
    event.put("start", Map.of("dateTime", RFC_3339.format(starts), "timeZone", zone));
    event.put("end", Map.of("dateTime", RFC_3339.format(ends), "timeZone", zone));
    // Always sent: an event the clinic removed earlier (a disconnect, then a
    // reconnect) still exists in Google as "cancelled" under the same id. The
    // insert is refused as a duplicate and the push falls back to an update —
    // which only brings the event back if it says so.
    event.put("status", "confirmed");
    event.put("colorId", colorId(a));
    List<Integer> reminders = settings.reminderMinutes();
    event.put("reminders", reminders.isEmpty()
        ? Map.of("useDefault", true)
        : Map.of("useDefault", false, "overrides", reminders.stream()
            .map(minutes -> Map.of("method", "popup", "minutes", minutes))
            .toList()));
    event.put(
        "extendedProperties",
        Map.of("private", Map.of(
            "labalanceAppointmentId", String.valueOf(a.appointmentId()), "source", "LA BALANCE")));
    return event;
  }
}
