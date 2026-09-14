package com.physiocare.clinic.checkout;

import com.physiocare.clinic.commission.CommissionAdjustmentService;
import com.physiocare.clinic.commission.CourseUsageService;
import com.physiocare.clinic.common.BranchAccessService;
import com.physiocare.clinic.common.CurrentUser;
import com.physiocare.clinic.common.InputRules;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Turns one pass at the counter into a receipt: the services and courses sold,
 * the course sessions spent, the payment taken, and the commission earned.
 *
 * <p>Everything that moves a course balance is written as a ledger entry, so the
 * balance is always the sum of its history rather than a number edited in place.
 *
 * <p>Course-pool commission (a course sale, and every session spent from one) no
 * longer books anything into {@code transaction_commissions} here — that ledger
 * now carries only the immediate single-visit service incentive. A course's
 * commission lives entirely in {@code patient_courses}/{@code commission_allocations},
 * released per visit through {@link CourseUsageService} once the month it was sold
 * in has been closed.
 */
@Service
public class CheckoutService {
  private final JdbcTemplate db;
  private final CheckoutRepository repository;
  private final BranchAccessService branches;
  private final CurrentUser currentUser;
  private final TransactionReader reader;
  private final CourseUsageService courseUsage;
  private final CommissionAdjustmentService adjustments;
  private final CheckoutCommissionService commissions;

  public CheckoutService(
      JdbcTemplate db,
      CheckoutRepository repository,
      BranchAccessService branches,
      CurrentUser currentUser,
      TransactionReader reader,
      CourseUsageService courseUsage,
      CommissionAdjustmentService adjustments,
      CheckoutCommissionService commissions) {
    this.db = db;
    this.repository = repository;
    this.branches = branches;
    this.currentUser = currentUser;
    this.reader = reader;
    this.courseUsage = courseUsage;
    this.adjustments = adjustments;
    this.commissions = commissions;
  }

  @Transactional
  public CheckoutDtos.TransactionView checkout(
      CheckoutDtos.CheckoutRequest r, Authentication authentication) {
    branches.requireAccess(authentication, r.branchId());
    branches.requireActiveBranch(r.branchId());
    branches.requirePatientExists(r.patientId());
    branches.requireStaffInBranch(r.treatingStaffId(), r.branchId(), "Treating staff");
    branches.requireStaffInBranch(r.salespersonId(), r.branchId(), "Salesperson");
    repository.requireActivePaymentMethod(r.paymentMethodId());
    if (r.appointmentId() != null)
      repository.requireAppointmentMatches(r.appointmentId(), r.patientId(), r.branchId(), r.serviceId());
    if (r.caseOwnerEmployeeId() != null) {
      branches.requireStaffInBranch(r.caseOwnerEmployeeId(), r.branchId(), "Case owner");
    }
    if (r.serviceId() == null && r.purchaseCourseId() == null && r.usePatientCourseId() == null
        && !r.useNewlyPurchasedSession()) {
      throw new IllegalArgumentException("Nothing to check out");
    }

    LocalDate today = LocalDate.now();
    String actor = currentUser.displayName(authentication);
    Long actorUserId = currentUser.id(authentication);

    List<CheckoutDtos.Adjustment> adjustments =
        (r.adjustments() == null ? List.<CheckoutDtos.Adjustment>of() : r.adjustments()).stream()
            .filter(a -> a.amount() != null && a.amount().signum() != 0)
            .toList();

    Map<String, Object> service =
        r.serviceId() == null ? null : repository.activeService(r.serviceId());
    Map<String, Object> course =
        r.purchaseCourseId() == null
            ? null
            : repository.activeCourse(r.purchaseCourseId());

    BigDecimal servicePrice =
        service == null
            ? BigDecimal.ZERO
            : (BigDecimal) service.get("base_price");
    BigDecimal coursePrice =
        course == null
            ? BigDecimal.ZERO
            : (BigDecimal) course.get("price");
    if (service != null) requireCatalogPrice(r.servicePrice(), servicePrice, "service");
    if (course != null) requireCatalogPrice(r.coursePurchasePrice(), coursePrice, "course");
    InputRules.money(servicePrice, "The service price");
    InputRules.money(coursePrice, "The course price");
    for (CheckoutDtos.Adjustment adjustment : adjustments) {
      InputRules.text(adjustment.label(), 250, "An adjustment label");
      InputRules.money(adjustment.amount().abs(), "An adjustment");
    }

    CheckoutPricing pricing = CheckoutPricing.calculate(servicePrice, coursePrice, adjustments);
    BigDecimal grossTotal = pricing.grossTotal();
    BigDecimal discountTotal = pricing.discountTotal();
    BigDecimal netTotal = pricing.netTotal();
    /* A discount larger than the bill is a keying mistake, so refuse it. */
    InputRules.require(
        netTotal.signum() >= 0,
        "The discount is larger than the bill. The most that can be taken off is "
            + grossTotal.add(pricing.adjustmentTotal().subtract(discountTotal)));

    /* Percentage commission follows the earned catalog lines after discounts. */
    BigDecimal discountRatio = pricing.discountRatio();

    long transactionId =
        db.queryForObject(
            "INSERT INTO sales_transactions(transaction_no,patient_id,branch_id,transaction_type,"
                + "status,subtotal,discount_amount,total_amount,salesperson_id,treating_staff_id,"
                + "appointment_id,payment_method_id,created_by)"
                + " VALUES(?,?,?,'SINGLE_VISIT','PAID',0,?,?,?,?,?,?,?) RETURNING id",
            Long.class,
            repository.nextNumber("INV", "sales_transactions", "transaction_no"),
            r.patientId(),
            r.branchId(),
            discountTotal.abs(),
            netTotal,
            r.salespersonId(),
            r.treatingStaffId(),
            r.appointmentId(),
            r.paymentMethodId(),
            actorUserId);

    BigDecimal subtotal = BigDecimal.ZERO;
    String type = "SINGLE_VISIT";
    Long patientCourseId = null;
    Long purchasedCourseId = null;

    // ---- service line -----------------------------------------------------
    if (service != null) {
      repository.addItem(transactionId, "SERVICE", (Long) idOf(service), null,
          (String) service.get("name_th"), servicePrice, "BASE");
      subtotal = subtotal.add(servicePrice);
      type = "ASSESSMENT".equals(service.get("service_type")) ? "ASSESSMENT" : "SINGLE_VISIT";
      if (r.treatingStaffId() != null) {
        commissions.record(
            transactionId,
            "TREATMENT",
            "SERVICE",
            (Long) idOf(service),
            r.treatingStaffId(),
            servicePrice.multiply(discountRatio),
            today);
      }
      // Single-visit checkout does not create course-pool commission and does
      // not require a salesperson. Course commission is released only from a
      // purchased course when its sessions are used.
    }

    // ---- course purchase --------------------------------------------------
    if (course != null) {
      int sessions = ((Number) course.get("total_sessions")).intValue();
      int bonus = ((Number) course.get("bonus_sessions")).intValue();
      String courseName = (String) course.get("name_th");
      repository.addItem(transactionId, "COURSE", null, (Long) idOf(course),
          courseName + " (" + sessions + " Sessions)", coursePrice, "BASE");
      subtotal = subtotal.add(coursePrice);
      type = service != null ? "MIXED" : "COURSE_PURCHASE";

      Integer validityDays =
          course.get("validity_days") == null ? null : ((Number) course.get("validity_days")).intValue();
      purchasedCourseId =
          repository.createPatientCourse(
              r.patientId(), r.branchId(), (Long) idOf(course), courseName, sessions, bonus,
              coursePrice, discountRatio, validityDays, transactionId, r.salespersonId(),
              r.caseOwnerEmployeeId() != null ? r.caseOwnerEmployeeId() : r.salespersonId(), today);
      patientCourseId = purchasedCourseId;

      repository.addLedgerEntry(purchasedCourseId, "PURCHASE", sessions, sessions, r.branchId(),
          transactionId, actor, actorUserId, null, null);
      if (bonus > 0)
        repository.addLedgerEntry(purchasedCourseId, "BONUS", bonus, sessions + bonus, r.branchId(),
            transactionId, actor, actorUserId, null, null);

      // No immediate SALES commission here: a course's commission lives
      // entirely in the pool this purchase just created, released per visit
      // once the sale month is closed (see MonthlyCommissionClosingService).
    }

    // ---- course usage -----------------------------------------------------
    Long useId = r.usePatientCourseId() != null ? r.usePatientCourseId()
        : (r.useNewlyPurchasedSession() ? purchasedCourseId : null);
    // Completing the appointment already spent a session from the patient's
    // course. That usage is settled by this receipt rather than repeated, and a
    // paid single visit on top of it would bill the visit twice.
    Map<String, Object> visitUsage =
        r.appointmentId() == null ? null : repository.visitUsageForAppointment(r.appointmentId());
    if (visitUsage != null) {
      long usedCourseId = ((Number) visitUsage.get("patient_course_id")).longValue();
      if (useId == null && service != null) {
        throw new IllegalArgumentException(
            "This visit already used a session from the patient's course. Check it out as"
                + " \"Use Existing Course\" instead of a paid visit.");
      }
      if (useId != null && useId != usedCourseId) {
        throw new IllegalArgumentException(
            "This visit already used a session from a different course");
      }
      if (useId != null) {
        int quantity = r.useSessionsCount() == null ? 1 : r.useSessionsCount();
        if (quantity != ((Number) visitUsage.get("quantity")).intValue()) {
          throw new IllegalArgumentException(
              "This visit already used " + visitUsage.get("quantity")
                  + " session(s) when the appointment was completed");
        }
        repository.linkUsageToTransaction(((Number) visitUsage.get("id")).longValue(), transactionId);
        patientCourseId = useId;
        type = (service != null || course != null) ? "MIXED" : "COURSE_USAGE";
        useId = null;
      }
    }
    if (useId != null) {
      int quantity = r.useSessionsCount() == null ? 1 : r.useSessionsCount();
      if (quantity <= 0) throw new IllegalArgumentException("Sessions used must be at least one");
      // Ownership (owner or an active shared member with balance) and the
      // remaining-sessions check both live in CourseUsageService now, since
      // a shared course member is not the patient_courses.patient_id.
      courseUsage.recordCheckoutUsage(
          useId, r.patientId(), quantity, r.branchId(), transactionId, r.treatingStaffId(),
          treatingStaffName(r.treatingStaffId(), actor), actorUserId, today);

      patientCourseId = useId;
      type = (service != null || course != null) ? "MIXED" : "COURSE_USAGE";
      // No immediate TREATMENT commission here either: the physiotherapist's
      // earnings for this session are the course's owner-net release (or the
      // Substitute Treatment Fee, if they are not the case owner) computed by
      // CommissionAllocationService — not a separate line on this receipt.
    }

    // ---- adjustments ------------------------------------------------------
    for (CheckoutDtos.Adjustment adjustment : adjustments) {
      repository.addItem(transactionId, "ADJUSTMENT", null, null, adjustment.label(), adjustment.amount(),
          adjustment.amount().signum() < 0 ? "DISCOUNT" : "SURCHARGE");
    }

    db.update(
        "UPDATE sales_transactions SET transaction_type=?,subtotal=?,patient_course_id=? WHERE id=?",
        type, subtotal, patientCourseId, transactionId);

    // ---- payment ----------------------------------------------------------
    if (netTotal.signum() > 0) {
      // Cash is counted at the drawer, so the note handed over is recorded
      // alongside the change owed. Revenue stays the amount billed — the change
      // goes straight back and was never the clinic's.
      BigDecimal cashReceived = repository.isCash(r.paymentMethodId()) ? r.cashReceived() : null;
      if (cashReceived != null) {
        InputRules.money(cashReceived, "The cash received");
        InputRules.require(
            cashReceived.compareTo(netTotal) >= 0,
            "The cash received is less than the amount due");
      }
      db.update(
          "INSERT INTO payments(payment_no,sales_transaction_id,payment_method_id,amount,"
              + "reference_no,received_by,cash_received,change_given) VALUES(?,?,?,?,?,?,?,?)",
          repository.nextNumber("PM", "payments", "payment_no"),
          transactionId,
          r.paymentMethodId(),
          netTotal,
          r.paymentReferenceNo(),
          actorUserId,
          cashReceived,
          cashReceived == null ? null : cashReceived.subtract(netTotal));
    }

    if (purchasedCourseId != null) repository.refreshCourseStatus(purchasedCourseId);
    return reader.get(transactionId);
  }

  static void requireCatalogPrice(BigDecimal supplied, BigDecimal catalog, String label) {
    if (supplied != null && supplied.compareTo(catalog) != 0)
      throw new IllegalArgumentException("The " + label + " price must match the active catalog price");
  }

  /**
   * Reverses a receipt instead of deleting it: the transaction is marked
   * cancelled and every course movement it caused gets an opposing ledger entry,
   * so the balance history still explains itself.
   */
  @Transactional
  public CheckoutDtos.TransactionView voidTransaction(
      long transactionId, String reason, Authentication authentication) {
    Map<String, Object> transaction =
        repository.row("SELECT * FROM sales_transactions WHERE id=? FOR UPDATE", transactionId, "Transaction");
    branches.requireAccess(authentication, ((Number) transaction.get("branch_id")).longValue());
    if ("CANCELLED".equals(transaction.get("status")))
      throw new IllegalArgumentException("This transaction has already been voided");

    String actor = currentUser.displayName(authentication);
    Long actorUserId = currentUser.id(authentication);

    List<Map<String, Object>> entries =
        db.queryForList(
            "SELECT id,patient_course_id,entry_type,quantity FROM course_ledger_entries WHERE"
                + " related_transaction_id=? AND entry_type<>'VOID_REVERSAL' ORDER BY id",
            transactionId);

    requireReversible(entries);

    for (Map<String, Object> entry : entries) {
      long patientCourseId = ((Number) entry.get("patient_course_id")).longValue();
      int quantity = ((Number) entry.get("quantity")).intValue();
      String entryType = (String) entry.get("entry_type");
      repository.lockPatientCourse(patientCourseId);

      switch (entryType) {
        case "PURCHASE" -> db.update(
            "UPDATE patient_courses SET total_visits=total_visits-? WHERE id=?", quantity, patientCourseId);
        case "BONUS" -> db.update(
            "UPDATE patient_courses SET bonus_visits=bonus_visits-? WHERE id=?", quantity, patientCourseId);
        case "TREATMENT" -> {
          db.update(
              "UPDATE patient_courses SET visits_used=visits_used+? WHERE id=?", quantity, patientCourseId);
          // The member whose balance this session came from is only known
          // through course_usages (the ledger entry itself carries no
          // patient_id) — a ledger entry predating that table has none, and
          // the balance/commission reversal below is then simply skipped.
          long ledgerEntryId = ((Number) entry.get("id")).longValue();
          db.update(
              "UPDATE course_member_balances SET used_visits=used_visits+?,updated_at=now() WHERE"
                  + " patient_course_id=? AND patient_id=(SELECT patient_id FROM course_usages WHERE"
                  + " course_ledger_entry_id=? LIMIT 1)",
              quantity, patientCourseId, ledgerEntryId);
          adjustments.reverseUsageForLedgerEntry(ledgerEntryId, actorUserId, reason);
        }
        default -> throw new IllegalArgumentException(
            "Cannot reverse a " + entryType + " entry automatically");
      }

      repository.addLedgerEntry(patientCourseId, "VOID_REVERSAL", -quantity,
          remaining(repository.patientCourse(patientCourseId)),
          ((Number) transaction.get("branch_id")).longValue(), transactionId, actor, actorUserId,
          null, (Long) entry.get("id"));
      repository.refreshCourseStatus(patientCourseId);
    }

    db.update(
        "UPDATE sales_transactions SET status='CANCELLED',cancelled_at=now() WHERE id=?", transactionId);
    db.update("UPDATE payments SET status='VOID' WHERE sales_transaction_id=?", transactionId);
    db.update(
        "UPDATE patient_courses SET status='REFUNDED',commission_status='CANCELLED' WHERE"
            + " sales_transaction_id=? AND visits_used=0",
        transactionId);
    db.update(
        "INSERT INTO transaction_cancellations(transaction_id,reason_code,reason_text,cancelled_by)"
            + " VALUES(?,'USER_REQUEST',?,?)",
        transactionId, reason, actorUserId);

    return reader.get(transactionId);
  }

  /**
   * A sale can only be taken back while the sessions it created are still
   * there. Once they have been spent elsewhere or transferred to another
   * patient, withdrawing them would leave that person holding sessions the
   * course no longer has — so the void is refused and the reversal is left to
   * be worked out by hand.
   */
  private void requireReversible(List<Map<String, Object>> entries) {
    Map<Long, int[]> deltas = new java.util.LinkedHashMap<>();
    for (Map<String, Object> entry : entries) {
      long courseId = ((Number) entry.get("patient_course_id")).longValue();
      int quantity = ((Number) entry.get("quantity")).intValue();
      int[] delta = deltas.computeIfAbsent(courseId, key -> new int[3]); // total, bonus, used
      switch ((String) entry.get("entry_type")) {
        case "PURCHASE" -> delta[0] -= quantity;
        case "BONUS" -> delta[1] -= quantity;
        case "TREATMENT" -> delta[2] += quantity;
        default -> throw new IllegalArgumentException(
            "This transaction contains a " + entry.get("entry_type")
                + " entry that cannot be reversed automatically");
      }
    }

    for (Map.Entry<Long, int[]> pending : deltas.entrySet()) {
      Map<String, Object> course = repository.patientCourse(pending.getKey());
      int[] delta = pending.getValue();
      Integer usedByMember = db.queryForObject(
          "SELECT count(*) FROM course_member_balances WHERE patient_course_id=? AND used_visits>0",
          Integer.class, pending.getKey());
      if (usedByMember != null && usedByMember > 0 && delta[0] < 0) {
        throw new IllegalArgumentException(
            "This sale cannot be voided: sessions from " + course.get("package_name_snapshot")
                + " have already been used by a course member.");
      }
      int entitlement =
          intOf(course, "total_visits") + delta[0]
              + intOf(course, "bonus_visits") + delta[1]
              + intOf(course, "transfer_in_visits");
      int committed =
          intOf(course, "visits_used") + delta[2] + intOf(course, "transfer_out_visits");
      if (committed > entitlement) {
        throw new IllegalArgumentException(
            "This sale cannot be voided: sessions from "
                + course.get("package_name_snapshot")
                + " have already been used or transferred to another patient.");
      }
    }
  }

  // ------------------------------------------------------------------ helpers

  public static int remaining(Map<String, Object> patientCourse) {
    return intOf(patientCourse, "total_visits")
        + intOf(patientCourse, "bonus_visits")
        + intOf(patientCourse, "transfer_in_visits")
        - intOf(patientCourse, "visits_used")
        - intOf(patientCourse, "transfer_out_visits");
  }

  private static int intOf(Map<String, Object> row, String column) {
    Object value = row.get(column);
    return value == null ? 0 : ((Number) value).intValue();
  }

  private String treatingStaffName(Long staffId, String fallback) {
    if (staffId == null) return fallback;
    String name = repository.staffName(staffId);
    return name == null || name.isBlank() ? fallback : name;
  }

  private static Object idOf(Map<String, Object> row) {
    return ((Number) row.get("id")).longValue();
  }

}
