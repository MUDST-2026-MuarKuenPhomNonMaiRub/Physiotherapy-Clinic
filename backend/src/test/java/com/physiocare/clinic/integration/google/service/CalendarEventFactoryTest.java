package com.physiocare.clinic.integration.google.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.physiocare.clinic.integration.google.config.GoogleSettings;
import com.physiocare.clinic.integration.google.model.AppointmentEventSource;
import java.time.Instant;
import java.util.Map;
import org.junit.jupiter.api.Test;

class CalendarEventFactoryTest {
  private final CalendarEventFactory factory =
      new CalendarEventFactory(new GoogleSettings("id", "secret", "http://cb", "http://clinic.test/"));

  private static AppointmentEventSource appointment(String nickname, String status) {
    return new AppointmentEventSource(42, status, Instant.parse("2026-10-01T03:00:00Z"),
        Instant.parse("2026-10-01T03:45:00Z"), "AP-2026-00042", "26R9090003", nickname,
        "Office Syndrome Treatment", "Treatment Room 1", "Rama 9", "Rama 9 Road", "Asia/Bangkok");
  }

  @Test
  @SuppressWarnings("unchecked")
  void eventIsInClinicTimeWithADeterministicIdAndALinkBack() {
    Map<String, Object> event = factory.build(appointment("เอ", "CONFIRMED"));

    assertThat(event.get("id")).isEqualTo("labalance42");
    assertThat(event.get("summary")).isEqualTo("เอ · Office Syndrome Treatment");
    // Seconds must be present: Google rejects "10:00+07:00" with 400 Bad Request.
    assertThat(((Map<String, Object>) event.get("start")).get("dateTime")).isEqualTo("2026-10-01T10:00:00+07:00");
    assertThat(((Map<String, Object>) event.get("end")).get("dateTime")).isEqualTo("2026-10-01T10:45:00+07:00");
    assertThat(((Map<String, Object>) event.get("start")).get("timeZone")).isEqualTo("Asia/Bangkok");
    assertThat((String) event.get("description"))
        .contains("HN 26R9090003", "Room: Treatment Room 1", "http://clinic.test/appointments/42");
    assertThat(event.get("location")).isEqualTo("Rama 9 Road");
  }

  @Test
  void withoutANicknameThePatientIsShownByHnOnly() {
    Map<String, Object> event = factory.build(appointment(" ", "COMPLETED"));

    assertThat(event.get("summary")).isEqualTo("✓ HN 26R9090003 · Office Syndrome Treatment");
  }
}
