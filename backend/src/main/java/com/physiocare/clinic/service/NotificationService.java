package com.physiocare.clinic.service;

import com.physiocare.clinic.security.CurrentUser;
import com.physiocare.clinic.security.PermissionGuard;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.YearMonth;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The header bell. Nothing is queued when something happens; each read works
 * out, from the clinic's own records, what this person should act on now —
 * so a notification disappears by itself once the thing is dealt with (the
 * patient is seen, the visit is billed). Only "I've seen it" is stored.
 *
 * <p>What a person is told depends on what they do:
 * <ul>
 *   <li>the front desk (appointment.edit or checkout.create) — patients left
 *       waiting, patients who have not turned up, visits not yet billed;
 *   <li>a physiotherapist — their patient has arrived, their next patient is
 *       due, and someone else moved, cancelled or handed over their booking;
 *   <li>managers — today's voids (transaction.void), a month still to close
 *       (commission.close), Google Calendar sync failures (settings.manage).
 * </ul>
 */
@Service
public class NotificationService {
  /** A patient who has waited this long without being taken in is flagged. */
  static final int WAITING_MINUTES = 10;
  /** A booked patient this late without arriving is flagged. */
  static final int LATE_MINUTES = 15;
  /** A therapist is told this far ahead that their next patient is due. */
  static final int SOON_MINUTES = 10;
  /** How far back changes to a therapist's bookings are reported. */
  static final int CHANGES_HOURS = 48;
  /** Closing the previous month is flagged during this many days of the new one. */
  static final int CLOSING_DUE_DAYS = 7;
  /** Read marks older than this are pruned; their notifications are long gone. */
  static final int READ_RETENTION_DAYS = 14;
  static final int MAX_ITEMS = 40;

  private static final String PATIENT_NAME =
      "CASE WHEN p.customer_type='FOREIGNER' THEN trim(coalesce(nullif(p.first_name_en,''),p.first_name_th,'')"
          + "||' '||coalesce(nullif(p.last_name_en,''),p.last_name_th,'')) ELSE"
          + " trim(coalesce(p.first_name_th,'')||' '||coalesce(p.last_name_th,'')) END";
  private static final String ACTOR_NAME =
      "COALESCE(NULLIF(trim(su.name),''),NULLIF(trim(u.first_name||' '||u.last_name),''))";
  /** Admins see every branch; everyone else the branches they are assigned to. */
  private static final String IN_SCOPE =
      " AND (?::boolean OR a.branch_id IN (SELECT branch_id FROM user_branches WHERE user_id=?))";

  private final JdbcTemplate db;
  private final CurrentUser currentUser;
  private final PermissionGuard permissions;

  public NotificationService(JdbcTemplate db, CurrentUser currentUser, PermissionGuard permissions) {
    this.db = db;
    this.currentUser = currentUser;
    this.permissions = permissions;
  }

  /** Who is asking, resolved once per read. */
  record Viewer(long userId, Long staffId, boolean admin, Authentication auth) {
    Object[] scope() {
      return new Object[] {admin, userId};
    }
  }

  public Map<String, Object> list(Authentication auth) {
    Long userId = currentUser.id(auth);
    if (userId == null) return Map.of("items", List.of(), "unread", 0);
    Viewer viewer = new Viewer(userId, currentUser.staffId(auth), currentUser.isAdmin(auth), auth);
    return list(viewer, OffsetDateTime.now());
  }

  Map<String, Object> list(Viewer viewer, OffsetDateTime now) {
    ZoneId clinic = ZoneId.systemDefault();
    LocalDate today = now.atZoneSameInstant(clinic).toLocalDate();
    OffsetDateTime dayStart = today.atStartOfDay(clinic).toOffsetDateTime();
    OffsetDateTime dayEnd = today.plusDays(1).atStartOfDay(clinic).toOffsetDateTime();

    List<Map<String, Object>> items = new ArrayList<>();
    // A therapist's own arrived patient is told to them directly; the front
    // desk copy of the same patient would only repeat it.
    Set<Object> toldDirectly = new HashSet<>();
    if (viewer.staffId() != null) {
      myArrivedPatients(viewer, dayStart, dayEnd, items, toldDirectly);
      myNextPatient(viewer, now, items);
      changesToMyBookings(viewer, now, items);
    }
    if (can(viewer, "appointment.edit") || can(viewer, "checkout.create")) {
      patientsWaiting(viewer, now, dayStart, dayEnd, items, toldDirectly);
      patientsLate(viewer, now, dayStart, items);
      bookingsLeftOpen(viewer, now, dayStart, items);
    }
    if (can(viewer, "checkout.create")) visitsToBill(viewer, dayStart, dayEnd, items);
    if (can(viewer, "transaction.void")) voidsToday(viewer, dayStart, items);
    if (can(viewer, "commission.close")) monthToClose(today, items);
    if (can(viewer, "settings.manage")) calendarSyncFailures(viewer, now, items);

    items.sort(Comparator.comparing((Map<String, Object> i) -> (Instant) i.get("occurredAt")).reversed());
    List<Map<String, Object>> shown = items.size() > MAX_ITEMS ? items.subList(0, MAX_ITEMS) : items;
    Set<String> read = readKeys(viewer.userId(), shown.stream().map(i -> (String) i.get("key")).toList());
    int unread = 0;
    for (Map<String, Object> item : shown) {
      boolean seen = read.contains((String) item.get("key"));
      item.put("read", seen);
      if (!seen) unread++;
    }
    return Map.of("items", shown, "unread", unread);
  }

  @Transactional
  public void markRead(Collection<String> keys, Authentication auth) {
    Long userId = currentUser.id(auth);
    if (userId == null || keys == null) return;
    for (String key : keys) {
      if (key == null || key.isBlank() || key.length() > 120) continue;
      db.update(
          "INSERT INTO notification_reads(user_id,notification_key) VALUES(?,?) ON CONFLICT DO NOTHING",
          userId, key);
    }
    db.update(
        "DELETE FROM notification_reads WHERE user_id=? AND read_at < now() - make_interval(days => ?)",
        userId, READ_RETENTION_DAYS);
  }

  // --- Physiotherapist -----------------------------------------------------

  private void myArrivedPatients(Viewer v, OffsetDateTime dayStart, OffsetDateTime dayEnd,
      List<Map<String, Object>> items, Set<Object> toldDirectly) {
    for (Map<String, Object> row : db.queryForList(
        "SELECT a.id,a.appointment_no,a.starts_at,a.ends_at," + PATIENT_NAME + " AS patient_name,"
            + " (SELECT max(e.occurred_at) FROM appointment_events e WHERE e.appointment_id=a.id"
            + " AND e.to_status='ARRIVED') AS arrived_at"
            + " FROM appointments a JOIN patients p ON p.id=a.patient_id"
            + " WHERE a.provider_staff_id=? AND a.status='ARRIVED' AND a.starts_at>=? AND a.starts_at<?",
        v.staffId(), dayStart, dayEnd)) {
      toldDirectly.add(row.get("id"));
      items.add(appointmentItem("arrived-" + row.get("id"), "MY_PATIENT_ARRIVED",
          firstNonNull(row.get("arrived_at"), row.get("starts_at")), row));
    }
  }

  private void myNextPatient(Viewer v, OffsetDateTime now, List<Map<String, Object>> items) {
    for (Map<String, Object> row : db.queryForList(
        "SELECT a.id,a.appointment_no,a.starts_at,a.ends_at," + PATIENT_NAME + " AS patient_name"
            + " FROM appointments a JOIN patients p ON p.id=a.patient_id"
            + " WHERE a.provider_staff_id=? AND a.status IN ('CONFIRMED','ARRIVED')"
            + " AND a.starts_at>? AND a.starts_at<=?",
        v.staffId(), now, now.plusMinutes(SOON_MINUTES))) {
      // Dated "now" rather than at the start time, so it sorts with what is
      // happening rather than above everything as a future event.
      Map<String, Object> item = appointmentItem("soon-" + row.get("id"), "STARTING_SOON", now, row);
      item.put("minutes", minutesBetween(now.toInstant(), instant(row.get("starts_at"))));
      items.add(item);
    }
  }

  /**
   * Moves, handovers, cancellations and new bookings on this therapist's
   * schedule made by somebody else. Their own changes are never reported back.
   */
  private void changesToMyBookings(Viewer v, OffsetDateTime now, List<Map<String, Object>> items) {
    for (Map<String, Object> row : db.queryForList(
        "SELECT e.id AS event_id,e.from_status,e.to_status,e.reason,e.occurred_at,"
            + " e.metadata->>'kind' AS kind,(e.metadata->>'fromProviderId')::bigint AS from_provider,"
            + " (e.metadata->>'toProviderId')::bigint AS to_provider,"
            + " e.metadata->>'oldStartsAt' AS old_starts_at,e.metadata->>'oldEndsAt' AS old_ends_at,"
            + " a.id,a.appointment_no,a.starts_at,a.ends_at,a.provider_staff_id,"
            + PATIENT_NAME + " AS patient_name," + ACTOR_NAME + " AS actor_name"
            + " FROM appointment_events e JOIN appointments a ON a.id=e.appointment_id"
            + " JOIN patients p ON p.id=a.patient_id"
            + " LEFT JOIN users u ON u.id=e.occurred_by"
            + " LEFT JOIN staff su ON su.user_id=u.id AND su.deleted_at IS NULL"
            + " WHERE e.occurred_at>=? AND (e.occurred_by IS NULL OR e.occurred_by<>?)"
            + " AND a.ends_at>=?"
            + " AND ((e.metadata->>'kind'='TIME_CHANGE' AND ((e.metadata->>'toProviderId')::bigint=?"
            + "   OR (e.metadata->>'fromProviderId')::bigint=?))"
            + "  OR (a.provider_staff_id=? AND e.from_status IS NULL AND e.to_status='CONFIRMED')"
            + "  OR (a.provider_staff_id=? AND e.to_status IN ('CANCELLED','NO_SHOW')"
            + "   AND e.from_status IS DISTINCT FROM e.to_status))",
        now.minusHours(CHANGES_HOURS), v.userId(), now,
        v.staffId(), v.staffId(), v.staffId(), v.staffId())) {
      String type;
      if ("TIME_CHANGE".equals(row.get("kind"))) {
        long from = ((Number) row.get("from_provider")).longValue();
        long to = ((Number) row.get("to_provider")).longValue();
        if (from == to) type = "BOOKING_RETIMED";
        else if (to == v.staffId()) type = "BOOKING_HANDED_TO_YOU";
        else type = "BOOKING_HANDED_AWAY";
      } else if ("CANCELLED".equals(row.get("to_status"))) {
        type = "BOOKING_CANCELLED";
      } else if ("NO_SHOW".equals(row.get("to_status"))) {
        type = "BOOKING_NO_SHOW";
      } else {
        // A reschedule makes a new booking whose first line names the old slot.
        String reason = (String) row.get("reason");
        type = reason != null && reason.startsWith("Rescheduled from") ? "BOOKING_RESCHEDULED" : "BOOKING_NEW";
      }
      Map<String, Object> item = appointmentItem("event-" + row.get("event_id"), type, row.get("occurred_at"), row);
      put(item, "actorName", row.get("actor_name"));
      if (row.get("old_starts_at") != null) {
        item.put("oldStartsAt", Instant.parse((String) row.get("old_starts_at")));
        item.put("oldEndsAt", Instant.parse((String) row.get("old_ends_at")));
      }
      items.add(item);
    }
  }

  // --- Front desk ----------------------------------------------------------

  private void patientsWaiting(Viewer v, OffsetDateTime now, OffsetDateTime dayStart, OffsetDateTime dayEnd,
      List<Map<String, Object>> items, Set<Object> toldDirectly) {
    List<Object> args = new ArrayList<>(List.of(dayStart, dayEnd));
    args.addAll(List.of(v.scope()));
    args.add(now.minusMinutes(WAITING_MINUTES));
    for (Map<String, Object> row : db.queryForList(
        "SELECT * FROM (SELECT a.id,a.appointment_no,a.starts_at,a.ends_at,"
            + PATIENT_NAME + " AS patient_name,s.name AS staff_name,"
            + " (SELECT max(e.occurred_at) FROM appointment_events e WHERE e.appointment_id=a.id"
            + " AND e.to_status='ARRIVED') AS arrived_at"
            + " FROM appointments a JOIN patients p ON p.id=a.patient_id"
            + " LEFT JOIN staff s ON s.id=a.provider_staff_id"
            + " WHERE a.status='ARRIVED' AND a.starts_at>=? AND a.starts_at<?" + IN_SCOPE + ") w"
            + " WHERE w.arrived_at<=?",
        args.toArray())) {
      if (toldDirectly.contains(row.get("id"))) continue;
      Map<String, Object> item = appointmentItem("waiting-" + row.get("id"), "PATIENT_WAITING", row.get("arrived_at"), row);
      put(item, "staffName", row.get("staff_name"));
      item.put("minutes", minutesBetween(instant(row.get("arrived_at")), now.toInstant()));
      items.add(item);
    }
  }

  /**
   * Only while the booked slot is still running: once it is over, "late" no
   * longer means anything and the booking is left for the counter to close
   * as arrived or no-show.
   */
  private void patientsLate(Viewer v, OffsetDateTime now, OffsetDateTime dayStart, List<Map<String, Object>> items) {
    List<Object> args = new ArrayList<>(List.of(dayStart, now.minusMinutes(LATE_MINUTES), now));
    args.addAll(List.of(v.scope()));
    for (Map<String, Object> row : db.queryForList(
        "SELECT a.id,a.appointment_no,a.starts_at,a.ends_at," + PATIENT_NAME + " AS patient_name,"
            + " s.name AS staff_name FROM appointments a JOIN patients p ON p.id=a.patient_id"
            + " LEFT JOIN staff s ON s.id=a.provider_staff_id"
            + " WHERE a.status='CONFIRMED' AND a.starts_at>=? AND a.starts_at<=? AND a.ends_at>?" + IN_SCOPE,
        args.toArray())) {
      Map<String, Object> item = appointmentItem("late-" + row.get("id"), "PATIENT_LATE", row.get("starts_at"), row);
      put(item, "staffName", row.get("staff_name"));
      item.put("minutes", minutesBetween(instant(row.get("starts_at")), now.toInstant()));
      items.add(item);
    }
  }

  /**
   * Today's bookings whose slot is over but which were never marked arrived or
   * no-show — one item for all of them, pointing at the calendar. Its key
   * follows the latest such booking, so it comes back as unread when another
   * slot runs out, not each time one is dealt with.
   */
  private void bookingsLeftOpen(Viewer v, OffsetDateTime now, OffsetDateTime dayStart, List<Map<String, Object>> items) {
    List<Object> args = new ArrayList<>(List.of(dayStart, now));
    args.addAll(List.of(v.scope()));
    Map<String, Object> row = db.queryForMap(
        "SELECT count(*) AS open,max(a.ends_at) AS last_ended_at FROM appointments a"
            + " WHERE a.status='CONFIRMED' AND a.starts_at>=? AND a.ends_at<=?" + IN_SCOPE,
        args.toArray());
    int open = ((Number) row.get("open")).intValue();
    if (open == 0) return;
    Instant last = instant(row.get("last_ended_at"));
    Map<String, Object> item = item("unresolved-" + last.getEpochSecond(), "BOOKINGS_LEFT_OPEN", last, "/calendar");
    item.put("count", open);
    items.add(item);
  }

  private void visitsToBill(Viewer v, OffsetDateTime dayStart, OffsetDateTime dayEnd, List<Map<String, Object>> items) {
    List<Object> args = new ArrayList<>(List.of(dayStart, dayEnd));
    args.addAll(List.of(v.scope()));
    for (Map<String, Object> row : db.queryForList(
        "SELECT a.id,a.appointment_no,a.starts_at,a.ends_at," + PATIENT_NAME + " AS patient_name,"
            + " (SELECT max(e.occurred_at) FROM appointment_events e WHERE e.appointment_id=a.id"
            + " AND e.to_status='COMPLETED') AS completed_at"
            + " FROM appointments a JOIN patients p ON p.id=a.patient_id"
            + " WHERE a.status='COMPLETED' AND a.starts_at>=? AND a.starts_at<?" + IN_SCOPE
            + " AND NOT EXISTS(SELECT 1 FROM sales_transactions st WHERE st.appointment_id=a.id"
            + " AND st.status<>'CANCELLED')",
        args.toArray())) {
      Map<String, Object> item = appointmentItem("checkout-" + row.get("id"), "AWAITING_CHECKOUT",
          firstNonNull(row.get("completed_at"), row.get("ends_at")), row);
      item.put("href", "/checkout");
      items.add(item);
    }
  }

  // --- Managers ------------------------------------------------------------

  private void voidsToday(Viewer v, OffsetDateTime dayStart, List<Map<String, Object>> items) {
    List<Object> args = new ArrayList<>(List.of(dayStart, v.userId()));
    args.addAll(List.of(v.scope()));
    for (Map<String, Object> row : db.queryForList(
        "SELECT c.id AS cancellation_id,c.cancelled_at,c.reason_code,c.reason_text,a.id,a.transaction_no,"
            + " a.total_amount," + PATIENT_NAME + " AS patient_name," + ACTOR_NAME + " AS actor_name"
            + " FROM transaction_cancellations c JOIN sales_transactions a ON a.id=c.transaction_id"
            + " JOIN patients p ON p.id=a.patient_id"
            + " LEFT JOIN users u ON u.id=c.cancelled_by"
            + " LEFT JOIN staff su ON su.user_id=u.id AND su.deleted_at IS NULL"
            + " WHERE c.cancelled_at>=? AND (c.cancelled_by IS NULL OR c.cancelled_by<>?)" + IN_SCOPE,
        args.toArray())) {
      Map<String, Object> item = item("void-" + row.get("cancellation_id"), "TRANSACTION_VOIDED",
          row.get("cancelled_at"), "/transactions/" + row.get("id"));
      put(item, "label", row.get("transaction_no"));
      put(item, "patientName", row.get("patient_name"));
      put(item, "actorName", row.get("actor_name"));
      put(item, "amount", row.get("total_amount"));
      Object text = row.get("reason_text");
      put(item, "reason", text != null && !text.toString().isBlank() ? text : row.get("reason_code"));
      items.add(item);
    }
  }

  private void monthToClose(LocalDate today, List<Map<String, Object>> items) {
    if (today.getDayOfMonth() > CLOSING_DUE_DAYS) return;
    YearMonth month = YearMonth.from(today).minusMonths(1);
    Boolean closed = db.queryForObject(
        "SELECT EXISTS(SELECT 1 FROM monthly_commission_closings WHERE closing_month=? AND status='CLOSED')",
        Boolean.class, month.atDay(1));
    if (Boolean.TRUE.equals(closed)) return;
    Map<String, Object> item = item("closing-" + month, "MONTH_TO_CLOSE",
        today.withDayOfMonth(1).atStartOfDay(ZoneId.systemDefault()).toInstant(), "/settings/monthly-closing");
    item.put("label", month.toString());
    items.add(item);
  }

  /**
   * Upcoming bookings that could not reach a therapist's Google Calendar. One
   * item for all of them; its key changes when another fails, so it comes
   * back as unread.
   */
  private void calendarSyncFailures(Viewer v, OffsetDateTime now, List<Map<String, Object>> items) {
    List<Object> args = new ArrayList<>(List.of(now));
    args.addAll(List.of(v.scope()));
    Map<String, Object> row = db.queryForMap(
        "SELECT count(*) AS failed,max(ce.updated_at) AS last_failed_at FROM appointment_calendar_events ce"
            + " JOIN appointments a ON a.id=ce.appointment_id"
            + " WHERE ce.sync_status='FAILED' AND a.starts_at>=?" + IN_SCOPE,
        args.toArray());
    int failed = ((Number) row.get("failed")).intValue();
    if (failed == 0) return;
    Instant last = instant(row.get("last_failed_at"));
    Map<String, Object> item = item("gsync-" + failed + "-" + last.getEpochSecond(), "CALENDAR_SYNC_FAILED",
        last, "/google-calendar");
    item.put("count", failed);
    items.add(item);
  }

  // --- Helpers -------------------------------------------------------------

  private boolean can(Viewer v, String permission) {
    return permissions.hasAny(v.auth(), permission);
  }

  private Set<String> readKeys(long userId, List<String> keys) {
    if (keys.isEmpty()) return Set.of();
    String marks = String.join(",", keys.stream().map(k -> "?").toList());
    List<Object> args = new ArrayList<>();
    args.add(userId);
    args.addAll(keys);
    return new HashSet<>(db.queryForList(
        "SELECT notification_key FROM notification_reads WHERE user_id=? AND notification_key IN (" + marks + ")",
        String.class, args.toArray()));
  }

  private static Map<String, Object> item(String key, String type, Object occurredAt, String href) {
    Map<String, Object> item = new LinkedHashMap<>();
    item.put("key", key);
    item.put("type", type);
    item.put("occurredAt", instant(occurredAt));
    item.put("href", href);
    return item;
  }

  private static Map<String, Object> appointmentItem(
      String key, String type, Object occurredAt, Map<String, Object> row) {
    Map<String, Object> item = item(key, type, occurredAt, "/appointments/" + row.get("id"));
    put(item, "appointmentNo", row.get("appointment_no"));
    put(item, "patientName", row.get("patient_name"));
    item.put("startsAt", instant(row.get("starts_at")));
    item.put("endsAt", instant(row.get("ends_at")));
    return item;
  }

  private static void put(Map<String, Object> item, String field, Object value) {
    if (value != null) item.put(field, value);
  }

  private static Object firstNonNull(Object first, Object second) {
    return first != null ? first : second;
  }

  private static long minutesBetween(Instant from, Instant to) {
    return Math.max(0, java.time.Duration.between(from, to).toMinutes());
  }

  private static Instant instant(Object value) {
    if (value instanceof Instant i) return i;
    if (value instanceof OffsetDateTime o) return o.toInstant();
    if (value instanceof Timestamp t) return t.toInstant();
    throw new IllegalArgumentException("Not a point in time: " + value);
  }
}
