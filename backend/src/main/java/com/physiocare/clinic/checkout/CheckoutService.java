package com.physiocare.clinic.checkout;

import com.physiocare.clinic.commission.CommissionAdjustmentService;
import com.physiocare.clinic.commission.CourseUsageService;
import com.physiocare.clinic.common.BranchAccessService;
import com.physiocare.clinic.common.CurrentUser;
import com.physiocare.clinic.common.InputRules;
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
  private final BranchAccessService branches;
  private final CurrentUser currentUser;
  private final TransactionReader reader;
  private final CourseUsageService courseUsage;
  private final CommissionAdjustmentService adjustments;

  public CheckoutService(
      JdbcTemplate db,
      BranchAccessService branches,
      CurrentUser currentUser,
      TransactionReader reader,
      CourseUsageService courseUsage,
      CommissionAdjustmentService adjustments) {
    this.db = db;
    this.branches = branches;
    this.currentUser = currentUser;
    this.reader = reader;
    this.courseUsage = courseUsage;
    this.adjustments = adjustments;
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
    InputRules.money(servicePrice, "The service price");
    InputRules.money(coursePrice, "The course price");
    for (CheckoutDtos.Adjustment adjustment : adjustments) {
      InputRules.text(adjustment.label(), 250, "An adjustment label");
      InputRules.money(adjustment.amount().abs(), "An adjustment");
    }

    BigDecimal grossTotal = servicePrice.add(coursePrice);
    BigDecimal adjustmentTotal =
        adjustments.stream().map(CheckoutDtos.Adjustment::amount).reduce(BigDecimal.ZERO, BigDecimal::add);
    BigDecimal discountTotal =
        adjustments.stream()
            .map(CheckoutDtos.Adjustment::amount)
            .filter(a -> a.signum() < 0)
            .reduce(BigDecimal.ZERO, BigDecimal::add);
    BigDecimal netTotal = grossTotal.add(adjustmentTotal);
    /*
     * Clamping a negative total to zero would leave a receipt whose lines no
     * longer add up to what was charged, which the transaction screen and the
     * revenue report both read as truth. A discount bigger than the bill is a
     * keying mistake, so it is refused rather than absorbed.
     */
    InputRules.require(
        netTotal.signum() >= 0,
        "The discount is larger than the bill. The most that can be taken off is "
            + grossTotal.add(adjustmentTotal.subtract(discountTotal)));

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
      if (r.treatingStaffId() != null) {
        recordCommission(
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
      addItem(transactionId, "COURSE", null, (Long) idOf(course),
          courseName + " (" + sessions + " Sessions)", coursePrice, "BASE");
      subtotal = subtotal.add(coursePrice);
      type = service != null ? "MIXED" : "COURSE_PURCHASE";

      Integer validityDays =
          course.get("validity_days") == null ? null : ((Number) course.get("validity_days")).intValue();
      purchasedCourseId =
          createPatientCourse(
              r.patientId(), r.branchId(), (Long) idOf(course), courseName, sessions, bonus,
              coursePrice, discountRatio, validityDays, transactionId, r.salespersonId(),
              r.treatingStaffId(), today);
      patientCourseId = purchasedCourseId;

      addLedgerEntry(purchasedCourseId, "PURCHASE", sessions, sessions, r.branchId(),
          transactionId, actor, actorUserId, null, null);
      if (bonus > 0)
        addLedgerEntry(purchasedCourseId, "BONUS", bonus, sessions + bonus, r.branchId(),
            transactionId, actor, actorUserId, null, null);

      // No immediate SALES commission here: a course's commission lives
      // entirely in the pool this purchase just created, released per visit
      // once the sale month is closed (see MonthlyCommissionClosingService).
    }

    // ---- course usage -----------------------------------------------------
    Long useId = r.usePatientCourseId() != null ? r.usePatientCourseId()
        : (r.useNewlyPurchasedSession() ? purchasedCourseId : null);
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
      addItem(transactionId, "ADJUSTMENT", null, null, adjustment.label(), adjustment.amount(),
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
      BigDecimal cashReceived = isCash(r.paymentMethodId()) ? r.cashReceived() : null;
      if (cashReceived != null) {
        InputRules.money(cashReceived, "The cash received");
        InputRules.require(
            cashReceived.compareTo(netTotal) >= 0,
            "The cash received is less than the amount due");
      }
      db.update(
          "INSERT INTO payments(payment_no,sales_transaction_id,payment_method_id,amount,"
              + "reference_no,received_by,cash_received,change_given) VALUES(?,?,?,?,?,?,?,?)",
          nextNumber("PM", "payments", "payment_no"),
          transactionId,
          r.paymentMethodId(),
          netTotal,
          r.paymentReferenceNo(),
          actorUserId,
          cashReceived,
          cashReceived == null ? null : cashReceived.subtract(netTotal));
    }

    if (purchasedCourseId != null) refreshCourseStatus(purchasedCourseId);
    return reader.get(transactionId);
  }

  /**
   * Cash is the one method where what changes hands is not the amount billed,
   * so it is the one method that carries a tendered figure. Read from the
   * method's own code rather than a hard-coded id, which differs per install.
   */
  private boolean isCash(long paymentMethodId) {
    // EXISTS always yields a row, so an unknown id answers "not cash" here and
    // is left to fail on the foreign key with a message that names it.
    return Boolean.TRUE.equals(
        db.queryForObject(
            "SELECT EXISTS(SELECT 1 FROM payment_methods WHERE id=? AND code='CASH')",
            Boolean.class,
            paymentMethodId));
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
      BigDecimal price, BigDecimal discountRatio, Integer validityDays, Long salesTransactionId,
      Long sellerId, Long caseOwnerId, LocalDate today) {
    Long seller = sellerId != null ? sellerId : caseOwnerId;
    Long owner = caseOwnerId != null ? caseOwnerId : seller;
    String sellerName = seller == null ? "" : staffName(seller);
    String ownerName = owner == null ? sellerName : staffName(owner);
    // The tier/pool base is the price actually collected, not the list
    // price — a counter override or a discount both shrink it, the same way
    // a percentage commission_rules line already follows what was earned.
    BigDecimal netSaleAmount = price.multiply(discountRatio).setScale(2, RoundingMode.HALF_UP);
    long id =
        db.queryForObject(
            "INSERT INTO patient_courses(course_id,receipt_no,sales_transaction_id,patient_id,"
                + "package_id,package_name_snapshot,sale_date,sale_month,seller_employee_id,"
                + "case_owner_employee_id,seller_name_snapshot,case_owner_name_snapshot,"
                + "course_price,net_course_sale_amount,total_visits,commissionable_visit_count,"
                + "bonus_visits,branch_id,valid_until,status)"
                + " VALUES(?,?,?,?,?,?,?,date_trunc('month',?::date),?,?,?,?,?,?,?,?,?,?,?,'ACTIVE')"
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
            owner,
            sellerName,
            ownerName,
            price,
            netSaleAmount,
            sessions,
            sessions,
            bonus,
            branchId,
            validityDays == null ? null : today.plusDays(validityDays));
    // Keep the per-patient balance in sync with every newly purchased course.
    // Checkout usage validates and decrements this row, including for shared
    // courses, so creating only patient_courses is not sufficient.
    db.update(
        "INSERT INTO shared_course_members(patient_course_id,patient_id,role)"
            + " VALUES(?,?,'OWNER') ON CONFLICT (patient_course_id,patient_id) DO NOTHING",
        id,
        patientId);
    db.update(
        "INSERT INTO course_member_balances(patient_course_id,patient_id,allocated_visits,used_visits)"
            + " VALUES(?,?,?,0) ON CONFLICT (patient_course_id,patient_id) DO NOTHING",
        id,
        patientId,
        sessions + bonus);
    return id;
  }

  public long addLedgerEntry(
      long patientCourseId, String entryType, int quantity, int balanceAfter, long branchId,
      Long transactionId, String performedBy, Long performedByUserId, String transferGroupId,
      Long reversalOfId) {
    return db.queryForObject(
        "INSERT INTO course_ledger_entries(patient_course_id,entry_type,quantity,balance_after,"
            + "branch_id,related_transaction_id,performed_by_name,created_by,transfer_group_id,"
            + "reversal_of_id) VALUES(?,?,?,?,?,?,?,?,?,?) RETURNING id",
        Long.class,
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

  public Map<String, Object> lockPatientCourse(long id) {
    return row("SELECT * FROM patient_courses WHERE id=? FOR UPDATE", id, "Course");
  }

  public Map<String, Object> patientCourse(long id) {
    return row("SELECT * FROM patient_courses WHERE id=?", id, "Course");
  }

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

  /** ACTIVE until it runs out of sessions or passes its expiry date. */
  public void refreshCourseStatus(long patientCourseId) {
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
