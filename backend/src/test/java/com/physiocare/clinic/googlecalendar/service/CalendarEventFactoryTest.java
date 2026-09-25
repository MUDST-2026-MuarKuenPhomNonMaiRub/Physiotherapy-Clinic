package com.physiocare.clinic.googlecalendar.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.physiocare.clinic.googlecalendar.model.AppointmentSyncSnapshot;
import com.physiocare.clinic.googlecalendar.model.CalendarEvent;
import java.time.OffsetDateTime;
import org.junit.jupiter.api.Test;

class CalendarEventFactoryTest {
  private final CalendarEventFactory factory = new CalendarEventFactory("Asia/Bangkok");

  private static AppointmentSyncSnapshot appointment(String room) {
    OffsetDateTime start = OffsetDateTime.parse("2026-10-01T03:00:00Z");
    return new AppointmentSyncSnapshot(42, "AP-2026-00042", "CONFIRMED", 7, start,
        start.plusMinutes(45), "HN000123", "เอ", "Office Syndrome", "Silom", room, null, null);
  }

  @Test
  void eventUsesBangkokTimeAndIdentifiesThePatientByHnAndShortName() {
    CalendarEvent event = factory.build(appointment("Room 1"));

    assertThat(event.summary()).isEqualTo("Office Syndrome · HN000123 เอ");
    assertThat(event.start()).isEqualTo(OffsetDateTime.parse("2026-10-01T10:00:00+07:00"));
    assertThat(event.end()).isEqualTo(OffsetDateTime.parse("2026-10-01T10:45:00+07:00"));
    assertThat(event.timeZone()).isEqualTo("Asia/Bangkok");
    assertThat(event.location()).isEqualTo("Silom · Room 1");
    assertThat(event.description()).contains("AP-2026-00042", "HN000123", "ห้อง: Room 1");
  }

  @Test
  void roomIsLeftOutWhenTheBookingHasNone() {
    CalendarEvent event = factory.build(appointment(null));

    assertThat(event.location()).isEqualTo("Silom");
    assertThat(event.description()).doesNotContain("ห้อง:");
  }
}
