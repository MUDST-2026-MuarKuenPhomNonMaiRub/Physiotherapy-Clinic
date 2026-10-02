package com.physiocare.clinic.notification;

import static org.assertj.core.api.Assertions.assertThat;

import com.physiocare.clinic.appointment.AppointmentController;
import com.physiocare.clinic.appointment.AppointmentService;
import com.physiocare.clinic.commission.AbstractCommissionIntegrationTest;
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

/** The header bell, against a throwaway PostgreSQL. */
class NotificationServiceIT extends AbstractCommissionIntegrationTest {
  private static final ZoneOffset BANGKOK = ZoneOffset.ofHours(7);
  /** Tomorrow, so drags are always into the future and the bell's "now" is after every write. */
  private static final LocalDate DAY = LocalDate.now(BANGKOK).plusDays(1);
  private static final OffsetDateTime NOON = at("12:00");

  @Autowired private NotificationService notifications;
  @Autowired private AppointmentService appointments;

  private static OffsetDateTime at(String time) {
    return OffsetDateTime.of(DAY, LocalTime.parse(time), BANGKOK);
  }

  private long userOf(long staffId) {
    return db.queryForObject("SELECT user_id FROM staff WHERE id=?", Long.class, staffId);
  }

  private NotificationService.Viewer admin() {
    long userId = seedActorUserId();
    Authentication auth = new UsernamePasswordAuthenticationToken(
        "actor" + userId + "@test.local", "x", List.of(new SimpleGrantedAuthority("ROLE_ADMIN")));
    return new NotificationService.Viewer(userId, null, true, auth);
  }

  /** A therapist with no permissions beyond their own schedule. */
  private NotificationService.Viewer physio(long staffId) {
    Authentication auth = new UsernamePasswordAuthenticationToken(
        "staff" + staffId + "@test.local", "x", List.of(new SimpleGrantedAuthority("ROLE_PHYSIO")));
    return new NotificationService.Viewer(userOf(staffId), staffId, false, auth);
  }

  private long book(long staffId, String start, String end, String status) {
    long id = nextId();
    long branchId = db.queryForObject(
        "SELECT id FROM branches WHERE active AND deleted_at IS NULL ORDER BY id LIMIT 1", Long.class);
    long serviceId = db.queryForObject("SELECT id FROM services ORDER BY id LIMIT 1", Long.class);
    db.update(
        "INSERT INTO appointments(id,appointment_no,patient_id,branch_id,provider_staff_id,service_id,"
            + "starts_at,ends_at,status) VALUES(?,?,?,?,?,?,?,?,?)",
        id, "AP-N-" + id, seedPatient("Bell"), branchId, staffId, serviceId, at(start), at(end), status);
    return id;
  }

  @SuppressWarnings("unchecked")
  private static List<Map<String, Object>> items(Map<String, Object> result) {
    return (List<Map<String, Object>>) result.get("items");
  }

  private static List<String> types(Map<String, Object> result) {
    return items(result).stream().map(i -> (String) i.get("type")).toList();
  }

  @Test
  void aHandoverIsToldToBothTherapistsButNotToWhoeverMadeIt() {
    long from = seedStaff("Dr From");
    long to = seedStaff("Dr To");
    long id = book(from, "14:00", "15:00", "CONFIRMED");
    NotificationService.Viewer admin = admin();

    appointments.changeTime(
        id, new AppointmentController.TimeChangeRequest(at("14:00"), at("15:00"), to), admin.auth());

    assertThat(types(notifications.list(physio(to), NOON))).containsExactly("BOOKING_HANDED_TO_YOU");
    assertThat(types(notifications.list(physio(from), NOON))).containsExactly("BOOKING_HANDED_AWAY");
    assertThat(types(notifications.list(admin, NOON))).doesNotContain(
        "BOOKING_HANDED_TO_YOU", "BOOKING_HANDED_AWAY");
  }

  @Test
  void aRetimeCarriesTheSlotItLeft() {
    long staff = seedStaff("Dr Retime");
    long id = book(staff, "14:00", "15:00", "CONFIRMED");

    appointments.changeTime(id, new AppointmentController.TimeChangeRequest(at("16:00"), at("17:00")), admin().auth());

    Map<String, Object> item = items(notifications.list(physio(staff), NOON)).get(0);
    assertThat(item.get("type")).isEqualTo("BOOKING_RETIMED");
    assertThat(item.get("oldStartsAt")).isEqualTo(at("14:00").toInstant());
    assertThat(item.get("startsAt")).isEqualTo(at("16:00").toInstant());
  }

  @Test
  void theFrontDeskHearsOfAPatientOnlyOnceTheyHaveWaitedTenMinutes() {
    long staff = seedStaff("Dr Busy");
    long waitedLong = book(staff, "11:30", "12:00", "ARRIVED");
    long justArrived = book(staff, "12:00", "12:30", "ARRIVED");
    db.update("INSERT INTO appointment_events(appointment_id,from_status,to_status,occurred_at)"
        + " VALUES(?,'CONFIRMED','ARRIVED',?)", waitedLong, at("11:40"));
    db.update("INSERT INTO appointment_events(appointment_id,from_status,to_status,occurred_at)"
        + " VALUES(?,'CONFIRMED','ARRIVED',?)", justArrived, at("11:55"));

    List<Map<String, Object>> waiting = items(notifications.list(admin(), NOON)).stream()
        .filter(i -> "PATIENT_WAITING".equals(i.get("type"))).toList();

    assertThat(waiting).extracting(i -> i.get("key")).contains("waiting-" + waitedLong)
        .doesNotContain("waiting-" + justArrived);
    assertThat(waiting).filteredOn(i -> i.get("key").equals("waiting-" + waitedLong))
        .extracting(i -> i.get("minutes")).containsExactly(20L);
    // The therapist is told about both of their own patients straight away.
    assertThat(types(notifications.list(physio(staff), NOON)))
        .containsOnly("MY_PATIENT_ARRIVED").hasSize(2);
  }

  @Test
  void aPatientFifteenMinutesLateIsFlagged() {
    long late = book(seedStaff("Dr Late"), "11:30", "12:30", "CONFIRMED");
    long notYet = book(seedStaff("Dr Nearly"), "11:50", "12:20", "CONFIRMED");
    long over = book(seedStaff("Dr Over"), "09:00", "10:00", "CONFIRMED");

    List<Object> keys = items(notifications.list(admin(), NOON)).stream()
        .filter(i -> "PATIENT_LATE".equals(i.get("type"))).map(i -> i.get("key")).toList();

    assertThat(keys).contains("late-" + late).doesNotContain("late-" + notYet)
        // A slot that has already ended is no longer "late".
        .doesNotContain("late-" + over);
  }

  @Test
  void bookingsWhoseSlotEndedUnmarkedAreCountedInOneItem() {
    book(seedStaff("Dr Open A"), "09:00", "10:00", "CONFIRMED");
    book(seedStaff("Dr Open B"), "10:00", "11:00", "CONFIRMED");
    book(seedStaff("Dr Marked"), "09:00", "10:00", "NO_SHOW");
    book(seedStaff("Dr Running"), "11:30", "12:30", "CONFIRMED");

    List<Map<String, Object>> open = items(notifications.list(admin(), NOON)).stream()
        .filter(i -> "BOOKINGS_LEFT_OPEN".equals(i.get("type"))).toList();

    assertThat(open).hasSize(1);
    assertThat(open.get(0).get("count")).isEqualTo(2);
    assertThat(open.get(0).get("href")).isEqualTo("/calendar");
  }

  @Test
  void readMarksAreKeptPerPersonOnTheServer() {
    long staff = seedStaff("Dr Read");
    book(staff, "11:30", "12:30", "ARRIVED");
    NotificationService.Viewer therapist = physio(staff);

    Map<String, Object> before = notifications.list(therapist, NOON);
    assertThat(before.get("unread")).isEqualTo(1);
    notifications.markRead(List.of((String) items(before).get(0).get("key")), therapist.auth());

    Map<String, Object> after = notifications.list(therapist, NOON);
    assertThat(after.get("unread")).isEqualTo(0);
    assertThat(items(after).get(0).get("read")).isEqualTo(true);
  }
}
