package com.physiocare.clinic.commission;

import com.physiocare.clinic.checkout.CheckoutService;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

/**
 * The one place a spent course session becomes a {@code course_usages} row —
 * whether the session was recorded at checkout or (in a future integration)
 * from a completed appointment. It decrements the specific member's balance
 * (so a shared course's owner and members draw from the one pool correctly),
 * writes the ledger entry, and either allocates the commission immediately
 * (course already LOCKED) or leaves it PENDING_RATE for the month's close to
 * pick up.
 *
 * <p>Deliberately holds no dependency on {@link CheckoutService} — that would
 * form a constructor cycle, since checkout calls into this service to record
 * a usage. The couple of statements this needs from the ledger are small
 * enough to own directly.
 */
@Service
public class CourseUsageService {
  private final JdbcTemplate db;
  private final CommissionAllocationService allocationService;

  public CourseUsageService(JdbcTemplate db, CommissionAllocationService allocationService) {
    this.db = db;
    this.allocationService = allocationService;
  }

  /**
   * Records one checkout-driven usage against a patient course. The caller
   * (checkout) has already validated the transaction as a whole; this method
   * owns the course-balance side: it locks the course, decrements the
   * specific patient's member balance (owner or shared member — both are
   * rows in {@code course_member_balances}), and either allocates the
   * commission now or queues it for the next close.
   *
   * @return the {@code course_usages.id} created (or the existing one, if
   *     this exact checkout/course pair was already recorded — replaying a
   *     retried request must not double-decrement the balance).
   */
  @Transactional
  public long recordCheckoutUsage(
      long patientCourseId,
      long patientId,
      int quantity,
      long branchId,
      Long transactionId,
      Long treatingStaffId,
      String performedByName,
      Long performedByUserId,
      LocalDate usageDate) {
    return recordUsage(
        patientCourseId, patientId, quantity, branchId, transactionId, null, treatingStaffId,
        performedByName, performedByUserId, usageDate);
  }

  /** Records one session produced by completing an appointment. */
  @Transactional
  public long recordAppointmentUsage(
      long patientCourseId,
      long patientId,
      int quantity,
      long branchId,
      long appointmentId,
      Long treatingStaffId,
      String performedByName,
      Long performedByUserId,
      LocalDate usageDate) {
    return recordUsage(
        patientCourseId, patientId, quantity, branchId, null, appointmentId, treatingStaffId,
        performedByName, performedByUserId, usageDate);
  }

  private long recordUsage(
      long patientCourseId,
      long patientId,
      int quantity,
      long branchId,
      Long transactionId,
      Long appointmentId,
      Long treatingStaffId,
      String performedByName,
      Long performedByUserId,
      LocalDate usageDate) {
    String idempotencyKey =
        transactionId != null
            ? "checkout:" + transactionId + ":course:" + patientCourseId
            : appointmentId == null ? null : "appointment:" + appointmentId + ":course:" + patientCourseId;
    if (idempotencyKey != null) {
      List<Long> existing =
          db.queryForList("SELECT id FROM course_usages WHERE idempotency_key=?", Long.class, idempotencyKey);
      if (!existing.isEmpty()) return existing.get(0);
    }

    Map<String, Object> course = lockCourse(patientCourseId);
    Map<String, Object> balance;
    try {
      balance =
          db.queryForMap(
              "SELECT * FROM course_member_balances WHERE patient_course_id=? AND patient_id=? FOR"
                  + " UPDATE",
              patientCourseId,
              patientId);
    } catch (EmptyResultDataAccessException e) {
      throw new IllegalArgumentException("That course does not belong to this patient");
    }
    int memberRemaining = intOf(balance, "allocated_visits") - intOf(balance, "used_visits");
    if (memberRemaining < quantity)
      throw new IllegalArgumentException("Not enough sessions remaining on this course");

    db.update("UPDATE patient_courses SET visits_used=visits_used+? WHERE id=?", quantity, patientCourseId);
    db.update(
        "UPDATE course_member_balances SET used_visits=used_visits+?,updated_at=now() WHERE"
            + " patient_course_id=? AND patient_id=?",
        quantity,
        patientCourseId,
        patientId);
    Map<String, Object> updated = lockCourse(patientCourseId);

    long ledgerEntryId =
        db.queryForObject(
            "INSERT INTO course_ledger_entries(patient_course_id,entry_type,quantity,balance_after,"
                + "branch_id,related_transaction_id,performed_by_name,created_by) VALUES(?,?,?,?,?,?,?,?)"
                + " RETURNING id",
            Long.class,
            patientCourseId,
            "TREATMENT",
            -quantity,
            CheckoutService.remaining(updated),
            branchId,
            transactionId,
            performedByName,
            performedByUserId);

    db.update(
        "UPDATE patient_courses SET status = CASE"
            + "  WHEN status='REFUNDED' THEN 'REFUNDED'"
            + "  WHEN valid_until IS NOT NULL AND valid_until < CURRENT_DATE THEN 'EXPIRED'"
            + "  WHEN (total_visits+bonus_visits+transfer_in_visits-visits_used-transfer_out_visits)"
            + "       <= 0 THEN 'USED_UP'"
            + "  ELSE 'ACTIVE' END WHERE id=?",
        patientCourseId);

    Long caseOwnerId =
        course.get("case_owner_employee_id") == null
            ? null
            : ((Number) course.get("case_owner_employee_id")).longValue();
    long ownerId = caseOwnerId != null ? caseOwnerId : ((Number) course.get("patient_id")).longValue();
    long treatingId = treatingStaffId != null ? treatingStaffId : ownerId;
    Long visitId = resolveVisitId(transactionId, appointmentId);

    String commissionStatus = (String) course.get("commission_status");
    boolean everAllocatable = "PROVISIONAL".equals(commissionStatus) || "LOCKED".equals(commissionStatus);
    String initialStatus = everAllocatable ? "PENDING_RATE" : "LEGACY_UNALLOCATED";

    long usageId =
        db.queryForObject(
            "INSERT INTO course_usages(patient_course_id,patient_id,visit_id,sales_transaction_id,"
                + "course_ledger_entry_id,treating_employee_id,case_owner_employee_id,quantity,"
                + "usage_date,status,branch_id,created_by,idempotency_key) VALUES"
                + "(?,?,?,?,?,?,?,?,?,?,?,?,?) RETURNING id",
            Long.class,
            patientCourseId,
            patientId,
            visitId,
            transactionId,
            ledgerEntryId,
            treatingId,
            ownerId,
            quantity,
            usageDate,
            initialStatus,
            branchId,
            performedByUserId,
            idempotencyKey);

    if ("PENDING_RATE".equals(initialStatus) && "LOCKED".equals(commissionStatus)) {
      allocationService.allocate(usageId);
    }
    return usageId;
  }

  private Map<String, Object> lockCourse(long id) {
    List<Map<String, Object>> rows =
        db.queryForList("SELECT * FROM patient_courses WHERE id=? FOR UPDATE", id);
    if (rows.isEmpty())
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Course not found");
    return rows.get(0);
  }

  /**
   * A checkout usage that started life as a completed appointment carries the
   * transaction's appointment id; the visit that appointment produced is
   * looked up here rather than the client asserting one, since only the
   * server's own appointment/visit history can be trusted for who actually
   * treated the patient.
   */
  private Long resolveVisitId(Long transactionId, Long appointmentId) {
    if (transactionId == null && appointmentId == null) return null;
    List<Long> ids =
        db.queryForList(
            "SELECT v.id FROM visits v WHERE (?::bigint IS NOT NULL AND v.appointment_id=?) OR"
                + " (?::bigint IS NOT NULL AND v.appointment_id=(SELECT appointment_id FROM"
                + " sales_transactions WHERE id=?))",
            Long.class,
            appointmentId,
            appointmentId,
            transactionId,
            transactionId);
    return ids.isEmpty() ? null : ids.get(0);
  }

  private static int intOf(Map<String, Object> row, String column) {
    Object value = row.get(column);
    return value == null ? 0 : ((Number) value).intValue();
  }
}
