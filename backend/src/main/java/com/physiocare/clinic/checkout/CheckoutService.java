package com.physiocare.clinic.checkout;

import com.physiocare.clinic.common.BranchAccessService;
import com.physiocare.clinic.common.CurrentUser;
import java.math.BigDecimal;
import java.math.RoundingMode;
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
 */
@Service
public class CheckoutService {
  private final JdbcTemplate db;
  private final BranchAccessService branches;
  private final CurrentUser currentUser;
  private final TransactionReader reader;

  public CheckoutService(
      JdbcTemplate db,
      BranchAccessService branches,
      CurrentUser currentUser,
      TransactionReader reader) {
    this.db = db;
    this.branches = branches;
    this.currentUser = currentUser;
    this.reader = reader;
  }

  @Transactional
  public CheckoutDtos.TransactionView checkout(
      CheckoutDtos.CheckoutRequest r, Authentication authentication) {
    branches.requireAccess(authentication, r.branchId());
    branches.requireActiveBranch(r.branchId());
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
        r.serviceId() == null ? null : row("SELECT * FROM services WHERE id=?", r.serviceId(), "Service");
    Map<String, Object> course =
        r.purchaseCourseId() == null
            ? null
            : row("SELECT * FROM courses WHERE id=?", r.purchaseCourseId(), "Course");

    BigDecimal servicePrice =
        service == null
            ? BigDecimal.ZERO
            : r.servicePrice() != null ? r.servicePrice() : (BigDecimal) service.get("base_price");
    BigDecimal coursePrice =
        course == null
            ? BigDecimal.ZERO
            : r.coursePurchasePrice() != null ? r.coursePurchasePrice() : (BigDecimal) course.get("price");
    if (servicePrice.signum() < 0 || coursePrice.signum() < 0)
      throw new IllegalArgumentException("A price cannot be negative");

    BigDecimal grossTotal = servicePrice.add(coursePrice);
    BigDecimal adjustmentTotal =
        adjustments.stream().map(CheckoutDtos.Adjustment::amount).reduce(BigDecimal.ZERO, BigDecimal::add);
    BigDecimal discountTotal =
        adjustments.stream()
            .map(CheckoutDtos.Adjustment::amount)
            .filter(a -> a.signum() < 0)
            .reduce(BigDecimal.ZERO, BigDecimal::add);
    BigDecimal netTotal = grossTotal.add(adjustmentTotal).max(BigDecimal.ZERO);

    /*
     * Percentage commission follows what was actually earned: a counter price
     * override and any discount both shrink it, spread across the base lines in
     * proportion to their price. Ad-hoc extra charges are not part of the item
     * the rule prices, so they never inflate it.
     */
    BigDecimal discountRatio =
        grossTotal.signum() > 0
            ? grossTotal.add(discountTotal).max(BigDecimal.ZERO).divide(grossTotal, 10, RoundingMode.HALF_UP)
            : BigDecimal.ONE;

    long transactionId =
        db.queryForObject(
            "INSERT INTO sales_transactions(transaction_no,patient_id,branch_id,transaction_type,"
                + "status,subtotal,discount_amount,total_amount,salesperson_id,treating_staff_id,"
                + "appointment_id,payment_method_id,created_by)"
                + " VALUES(?,?,?,'SINGLE_VISIT','PAID',0,?,?,?,?,?,?,?) RETURNING id",
            Long.class,
            nextNumber("INV", "sales_transactions", "transaction_no"),
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
      addItem(transactionId, "SERVICE", (Long) idOf(service), null,
          (String) service.get("name_th"), servicePrice, "BASE");
      subtotal = subtotal.add(servicePrice);
      type = "ASSESSMENT".equals(service.get("service_type")) ? "ASSESSMENT" : "SINGLE_VISIT";
      BigDecimal base = servicePrice.multiply(discountRatio);
      if (r.treatingStaffId() != null)
        recordCommission(transactionId, "TREATMENT", "SERVICE", (Long) idOf(service),
            r.treatingStaffId(), base, today);
      if (r.salespersonId() != null)
        recordCommission(transactionId, "SALES", "SERVICE", (Long) idOf(service),
            r.salespersonId(), base, today);
    }

    // ---- course purchase --------------------------------------------------
    if (course != null) {
      int sessions = ((Number) course.get("total_sessions")).intValue();
      int bonus = ((Number) course.get("bonus_sessions")).intValue();
      String courseName = (String) course.get("name_th");
      addItem(transactionId, "COURSE", null, (Long) idOf(course),
          courseName + " (" + sessions + " Sessions)", coursePrice, "BASE");
      subtotal = subtotal.add(coursePrice);
      type = service != null ? "MIXED" : "COURSE_PURCHASE";

      Integer validityDays =
          course.get("validity_days") == null ? null : ((Number) course.get("validity_days")).intValue();
      purchasedCourseId =
          createPatientCourse(
              r.patientId(), r.branchId(), (Long) idOf(course), courseName, sessions, bonus,
              coursePrice, validityDays, transactionId, r.salespersonId(), r.treatingStaffId(), today);
      patientCourseId = purchasedCourseId;

      addLedgerEntry(purchasedCourseId, "PURCHASE", sessions, sessions, r.branchId(),
          transactionId, actor, actorUserId, null, null);
      if (bonus > 0)
        addLedgerEntry(purchasedCourseId, "BONUS", bonus, sessions + bonus, r.branchId(),
            transactionId, actor, actorUserId, null, null);

      if (r.salespersonId() != null)
        recordCommission(transactionId, "SALES", "COURSE", (Long) idOf(course),
            r.salespersonId(), coursePrice.multiply(discountRatio), today);
    }

    // ---- course usage -----------------------------------------------------
    Long useId = r.usePatientCourseId() != null ? r.usePatientCourseId()
        : (r.useNewlyPurchasedSession() ? purchasedCourseId : null);
    if (useId != null) {
      int quantity = r.useSessionsCount() == null ? 1 : r.useSessionsCount();
      if (quantity <= 0) throw new IllegalArgumentException("Sessions used must be at least one");
      Map<String, Object> patientCourse = lockPatientCourse(useId);
      if (((Number) patientCourse.get("patient_id")).longValue() != r.patientId())
        throw new IllegalArgumentException("That course does not belong to this patient");
      if (remaining(patientCourse) < quantity)
        throw new IllegalArgumentException("Not enough sessions remaining on this course");

      db.update("UPDATE patient_courses SET visits_used=visits_used+? WHERE id=?", quantity, useId);
      Map<String, Object> updated = patientCourse(useId);
      addLedgerEntry(useId, "TREATMENT", -quantity, remaining(updated), r.branchId(),
          transactionId, treatingStaffName(r.treatingStaffId(), actor), actorUserId, null, null);
      refreshCourseStatus(useId);

      patientCourseId = useId;
      type = (service != null || course != null) ? "MIXED" : "COURSE_USAGE";
      if (r.treatingStaffId() != null)
        recordCommission(transactionId, "TREATMENT", "COURSE",
            ((Number) updated.get("package_id")).longValue(), r.treatingStaffId(),
            subtotal.multiply(discountRatio), today);
    }

    // ---- adjustments ------------------------------------------------------
    for (CheckoutDtos.Adjustment adjustment : adjustments) {
      addItem(transactionId, "ADJUSTMENT", null, null, adjustment.label(), adjustment.amount(),
          adjustment.amount().signum() < 0 ? "DISCOUNT" : "SURCHARGE");
    }

    db.update(
        "UPDATE sales_transactions SET transaction_type=?,subtotal=?,patient_course_id=? WHERE id=?",
        type, subtotal, patientCourseId, transactionId);

    // ---- payment ----------------------------------------------------------
    if (netTotal.signum() > 0) {
      db.update(
          "INSERT INTO payments(payment_no,sales_transaction_id,payment_method_id,amount,"
              + "reference_no,received_by) VALUES(?,?,?,?,?,?)",
          nextNumber("PM", "payments", "payment_no"),
          transactionId,
          r.paymentMethodId(),
          netTotal,
          r.paymentReferenceNo(),
          actorUserId);
    }

    if (purchasedCourseId != null) refreshCourseStatus(purchasedCourseId);
    return reader.get(transactionId);
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
        row("SELECT * FROM sales_transactions WHERE id=? FOR UPDATE", transactionId, "Transaction");
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
      lockPatientCourse(patientCourseId);

      switch (entryType) {
        case "PURCHASE" -> db.update(
            "UPDATE patient_courses SET total_visits=total_visits-? WHERE id=?", quantity, patientCourseId);
        case "BONUS" -> db.update(
            "UPDATE patient_courses SET bonus_visits=bonus_visits-? WHERE id=?", quantity, patientCourseId);
        case "TREATMENT" -> db.update(
            "UPDATE patient_courses SET visits_used=visits_used+? WHERE id=?", quantity, patientCourseId);
        default -> throw new IllegalArgumentException(
            "Cannot reverse a " + entryType + " entry automatically");
      }

      addLedgerEntry(patientCourseId, "VOID_REVERSAL", -quantity,
          remaining(patientCourse(patientCourseId)),
          ((Number) transaction.get("branch_id")).longValue(), transactionId, actor, actorUserId,
          null, (Long) entry.get("id"));
      refreshCourseStatus(patientCourseId);
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
      Map<String, Object> course = patientCourse(pending.getKey());
      int[] delta = pending.getValue();
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

  private long createPatientCourse(
      long patientId, long branchId, long packageId, String packageName, int sessions, int bonus,
      BigDecimal price, Integer validityDays, Long salesTransactionId, Long sellerId,
      Long caseOwnerId, LocalDate today) {
    Long seller = sellerId != null ? sellerId : caseOwnerId;
    String sellerName = seller == null ? "" : staffName(seller);
    long id =
        db.queryForObject(
            "INSERT INTO patient_courses(course_id,receipt_no,sales_transaction_id,patient_id,"
                + "package_id,package_name_snapshot,sale_date,sale_month,seller_employee_id,"
                + "case_owner_employee_id,seller_name_snapshot,course_price,total_visits,"
                + "bonus_visits,branch_id,valid_until,status)"
                + " VALUES(?,?,?,?,?,?,?,date_trunc('month',?::date),?,?,?,?,?,?,?,?,'ACTIVE')"
                + " RETURNING id",
            Long.class,
            nextNumber("PC", "patient_courses", "course_id"),
            salesTransactionId == null
                ? null
                : db.queryForObject(
                    "SELECT transaction_no FROM sales_transactions WHERE id=?", String.class,
                    salesTransactionId),
            salesTransactionId,
            patientId,
            packageId,
            packageName,
            today,
            today,
            seller,
            caseOwnerId != null ? caseOwnerId : seller,
            sellerName,
            price,
            sessions,
            bonus,
            branchId,
            validityDays == null ? null : today.plusDays(validityDays));
    return id;
  }

  void addLedgerEntry(
      long patientCourseId, String entryType, int quantity, int balanceAfter, long branchId,
      Long transactionId, String performedBy, Long performedByUserId, String transferGroupId,
      Long reversalOfId) {
    db.update(
        "INSERT INTO course_ledger_entries(patient_course_id,entry_type,quantity,balance_after,"
            + "branch_id,related_transaction_id,performed_by_name,created_by,transfer_group_id,"
            + "reversal_of_id) VALUES(?,?,?,?,?,?,?,?,?,?)",
        patientCourseId, entryType, quantity, balanceAfter, branchId, transactionId, performedBy,
        performedByUserId, transferGroupId, reversalOfId);
  }

  private void addItem(
      long transactionId, String itemType, Long serviceId, Long courseId, String description,
      BigDecimal amount, String kind) {
    db.update(
        "INSERT INTO sales_items(sales_transaction_id,item_type,service_id,course_id,"
            + "description_snapshot,quantity,unit_price,total_amount,item_kind)"
            + " VALUES(?,?,?,?,?,1,?,?,?)",
        transactionId, itemType, serviceId, courseId, description, amount, amount, kind);
  }

  /**
   * The most specific live rule wins: one bound to this exact item, then one for
   * the whole category, then a catch-all.
   */
  private void recordCommission(
      long transactionId, String appliesTo, String targetType, Long targetId, long staffId,
      BigDecimal base, LocalDate on) {
    String targetColumn = "SERVICE".equals(targetType) ? "target_service_id" : "target_course_id";
    List<Map<String, Object>> rules =
        db.queryForList(
            "SELECT id,name,commission_type,value FROM commission_rules WHERE active AND"
                + " effective_date<=? AND (applies_to=? OR applies_to='BOTH') AND ("
                + "  (target_type=? AND " + targetColumn + "=?)"
                + "  OR (target_type=? AND " + targetColumn + " IS NULL)"
                + "  OR target_type='ALL')"
                + " ORDER BY CASE WHEN target_type=? AND " + targetColumn + "=? THEN 0"
                + "               WHEN target_type=? THEN 1 ELSE 2 END, effective_date DESC, id"
                + " LIMIT 1",
            on, appliesTo, targetType, targetId, targetType, targetType, targetId, targetType);
    if (rules.isEmpty()) return;

    Map<String, Object> rule = rules.get(0);
    BigDecimal value = (BigDecimal) rule.get("value");
    BigDecimal amount =
        "PERCENTAGE".equals(rule.get("commission_type"))
            ? base.multiply(value).divide(new BigDecimal("100"), 0, RoundingMode.HALF_UP)
            : value;
    db.update(
        "INSERT INTO transaction_commissions(sales_transaction_id,commission_rule_id,"
            + "rule_name_snapshot,staff_id,commission_type,amount) VALUES(?,?,?,?,?,?)",
        transactionId, rule.get("id"), rule.get("name"), staffId, appliesTo, amount);
  }

  Map<String, Object> lockPatientCourse(long id) {
    return row("SELECT * FROM patient_courses WHERE id=? FOR UPDATE", id, "Course");
  }

  Map<String, Object> patientCourse(long id) {
    return row("SELECT * FROM patient_courses WHERE id=?", id, "Course");
  }

  static int remaining(Map<String, Object> patientCourse) {
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

  /** ACTIVE until it runs out of sessions or passes its expiry date. */
  void refreshCourseStatus(long patientCourseId) {
    db.update(
        "UPDATE patient_courses SET status = CASE"
            + "  WHEN status='REFUNDED' THEN 'REFUNDED'"
            + "  WHEN valid_until IS NOT NULL AND valid_until < CURRENT_DATE THEN 'EXPIRED'"
            + "  WHEN (total_visits+bonus_visits+transfer_in_visits-visits_used-transfer_out_visits)"
            + "       <= 0 THEN 'USED_UP'"
            + "  ELSE 'ACTIVE' END WHERE id=?",
        patientCourseId);
  }

  private String treatingStaffName(Long staffId, String fallback) {
    if (staffId == null) return fallback;
    String name = staffName(staffId);
    return name == null || name.isBlank() ? fallback : name;
  }

  private String staffName(long staffId) {
    List<String> names =
        db.queryForList("SELECT name FROM staff WHERE id=?", String.class, staffId);
    return names.isEmpty() ? "" : names.get(0);
  }

  Map<String, Object> row(String sql, Object argument, String label) {
    List<Map<String, Object>> rows = db.queryForList(sql, argument);
    if (rows.isEmpty()) throw new IllegalArgumentException(label + " not found");
    return rows.get(0);
  }

  private static Object idOf(Map<String, Object> row) {
    return ((Number) row.get("id")).longValue();
  }

  /** Human-readable document numbers that stay unique without a dedicated sequence. */
  String nextNumber(String prefix, String table, String column) {
    Long next = db.queryForObject("SELECT count(*)+1 FROM " + table, Long.class);
    String candidate = String.format("%s-%d-%06d", prefix, LocalDate.now().getYear(), next);
    while (Boolean.TRUE.equals(
        db.queryForObject(
            "SELECT EXISTS(SELECT 1 FROM " + table + " WHERE " + column + "=?)",
            Boolean.class, candidate))) {
      next++;
      candidate = String.format("%s-%d-%06d", prefix, LocalDate.now().getYear(), next);
    }
    return candidate;
  }
}
