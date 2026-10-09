package com.physiocare.clinic.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.physiocare.clinic.dto.appointment.AppointmentDtos.TimeChangeRequest;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

/** The calendar's drag to move or resize a booking, against a throwaway PostgreSQL. */
class AppointmentTimeChangeIT extends AbstractCommissionIntegrationTest {
  private static final ZoneOffset BANGKOK = ZoneOffset.ofHours(7);
  /** Two days ahead, so the booking window never refuses the slot whatever day the suite runs. */
  private static final LocalDate DAY = LocalDate.now(BANGKOK).plusDays(2);

  @Autowired private AppointmentService appointments;

  private static OffsetDateTime at(String time) {
    return OffsetDateTime.of(DAY, LocalTime.parse(time), BANGKOK);
  }

  private Authentication admin() {
    long actor = seedActorUserId();
    return new UsernamePasswordAuthenticationToken(
        "actor" + actor + "@test.local", "x", List.of(new SimpleGrantedAuthority("ROLE_ADMIN")));
  }

  private long book(long staffId, String start, String end, String status) {
    long id = nextId();
    long branchId = db.queryForObject(
        "SELECT id FROM branches WHERE active AND deleted_at IS NULL ORDER BY id LIMIT 1", Long.class);
    long serviceId = db.queryForObject("SELECT id FROM services ORDER BY id LIMIT 1", Long.class);
    db.update(
        "INSERT INTO appointments(id,appointment_no,patient_id,branch_id,provider_staff_id,service_id,"
            + "starts_at,ends_at,status,patient_note) VALUES(?,?,?,?,?,?,?,?,?,'Bring MRI')",
        id, "AP-T-" + id, seedPatient("Drag"), branchId, staffId, serviceId, at(start), at(end), status);
    return id;
  }

  private Map<String, Object> row(long id) {
    return db.queryForMap("SELECT appointment_no,status,starts_at,ends_at,patient_note FROM appointments WHERE id=?", id);
  }

  private static OffsetDateTime instant(Object value) {
    if (value instanceof OffsetDateTime o) return o;
    return ((java.sql.Timestamp) value).toInstant().atOffset(ZoneOffset.UTC);
  }

  @Test
  void aBookedVisitMovesAndResizesInPlace() {
    long staff = seedStaff("Dr Drag");
    long id = book(staff, "10:00", "10:30", "CONFIRMED");
    String number = (String) row(id).get("appointment_no");

    appointments.changeTime(id, new TimeChangeRequest(at("11:00"), at("12:15")), admin());

    Map<String, Object> after = row(id);
    assertThat(after.get("appointment_no")).isEqualTo(number);
    assertThat(after.get("status")).isEqualTo("CONFIRMED");
    assertThat(after.get("patient_note")).isEqualTo("Bring MRI");
    assertThat(instant(after.get("starts_at")).isEqual(at("11:00"))).isTrue();
    assertThat(instant(after.get("ends_at")).isEqual(at("12:15"))).isTrue();
    // No second booking is made, unlike a reschedule.
    assertThat(db.queryForObject(
        "SELECT count(*) FROM appointments WHERE provider_staff_id=?", Long.class, staff)).isEqualTo(1);
    assertThat(db.queryForObject(
        "SELECT reason FROM appointment_events WHERE appointment_id=? ORDER BY id DESC LIMIT 1", String.class, id))
        .contains("Time changed from").contains("10:00–10:30").contains("11:00–12:15");
  }

  @Test
  void onceThePatientHasArrivedOnlyTheEndMoves() {
    long staff = seedStaff("Dr Arrived");
    long id = book(staff, "10:00", "10:30", "ARRIVED");

    appointments.changeTime(id, new TimeChangeRequest(at("10:00"), at("11:00")), admin());
    assertThat(instant(row(id).get("ends_at")).isEqual(at("11:00"))).isTrue();

    assertThatThrownBy(() -> appointments.changeTime(
            id, new TimeChangeRequest(at("10:15"), at("11:00")), admin()))
        .hasMessageContaining("only the end time");
  }

  @Test
  void aSlotThatRunsIntoTheTherapistsNextBookingIsRefused() {
    long staff = seedStaff("Dr Busy");
    long id = book(staff, "10:00", "10:30", "CONFIRMED");
    book(staff, "11:00", "11:30", "CONFIRMED");

    assertThatThrownBy(() -> appointments.changeTime(
            id, new TimeChangeRequest(at("10:00"), at("11:15")), admin()))
        .hasMessageContaining("already has an appointment");
    assertThat(instant(row(id).get("ends_at")).isEqual(at("10:30"))).isTrue();
  }

  @Test
  void aFinishedVisitCannotBeMoved() {
    long staff = seedStaff("Dr Done");
    long id = book(staff, "10:00", "10:30", "COMPLETED");

    assertThatThrownBy(() -> appointments.changeTime(
            id, new TimeChangeRequest(at("10:00"), at("11:00")), admin()))
        .hasMessageContaining("Only a booked or ongoing appointment");
  }

  private long staffOutsideTheBranch(String name) {
    long staffId = nextId();
    db.update(
        "INSERT INTO staff(id,name,position,email,branch_ids) VALUES(?,?,'Physiotherapist',?,'[0]')",
        staffId, name, "away" + staffId + "@test.local");
    return staffId;
  }

  private long provider(long appointmentId) {
    return db.queryForObject("SELECT provider_staff_id FROM appointments WHERE id=?", Long.class, appointmentId);
  }

  @Test
  void draggingIntoAnotherColumnHandsTheVisitToThatPhysiotherapist() {
    long from = seedStaff("Dr From");
    long to = seedStaff("Dr To");
    long id = book(from, "10:00", "10:30", "CONFIRMED");

    appointments.changeTime(
        id, new TimeChangeRequest(at("10:00"), at("10:30"), to), admin());

    assertThat(provider(id)).isEqualTo(to);
    assertThat(row(id).get("patient_note")).isEqualTo("Bring MRI");
    String history = db.queryForObject(
        "SELECT reason FROM appointment_events WHERE appointment_id=? ORDER BY id DESC LIMIT 1", String.class, id);
    assertThat(history).contains("Physiotherapist changed from Dr From to Dr To").doesNotContain("Time changed");
  }

  @Test
  void aHandoverIsRefusedWhenTheOtherTherapistIsBusyOrElsewhere() {
    long from = seedStaff("Dr Free");
    long busy = seedStaff("Dr Taken");
    long id = book(from, "10:00", "10:30", "CONFIRMED");
    book(busy, "10:15", "11:00", "CONFIRMED");

    assertThatThrownBy(() -> appointments.changeTime(
            id, new TimeChangeRequest(at("10:00"), at("10:30"), busy), admin()))
        .hasMessageContaining("already has an appointment");
    assertThatThrownBy(() -> appointments.changeTime(
            id, new TimeChangeRequest(
                at("10:00"), at("10:30"), staffOutsideTheBranch("Dr Elsewhere")), admin()))
        .hasMessageContaining("not active in this branch");
    assertThat(provider(id)).isEqualTo(from);
  }

  @Test
  void onceThePatientHasArrivedTheTherapistStays() {
    long from = seedStaff("Dr Treating");
    long other = seedStaff("Dr Spare");
    long id = book(from, "10:00", "10:30", "ARRIVED");

    assertThatThrownBy(() -> appointments.changeTime(
            id, new TimeChangeRequest(at("10:00"), at("10:30"), other), admin()))
        .hasMessageContaining("physiotherapist cannot change");
  }
}
