package com.physiocare.clinic.service;

import com.physiocare.clinic.dto.checkout.CheckoutDtos;
import com.physiocare.clinic.repository.CheckoutRepository;
import com.physiocare.clinic.security.BranchAccessService;
import com.physiocare.clinic.security.CurrentUser;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Handles receipt reversal independently from new checkout creation. */
@Service
class CheckoutVoidService {
  private final JdbcTemplate db;
  private final CheckoutRepository repository;
  private final BranchAccessService branches;
  private final CurrentUser currentUser;
  private final CommissionAdjustmentService adjustments;
  private final AuditService audit;
  private final TransactionReader reader;
  CheckoutVoidService(JdbcTemplate db, CheckoutRepository repository, BranchAccessService branches, CurrentUser currentUser, CommissionAdjustmentService adjustments, AuditService audit, TransactionReader reader) {
    this.db=db; this.repository=repository; this.branches=branches; this.currentUser=currentUser; this.adjustments=adjustments; this.audit=audit; this.reader=reader;
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
        case "PURCHASE" -> {
          db.update(
              "UPDATE patient_courses SET total_visits=total_visits-? WHERE id=?", quantity, patientCourseId);
          withdrawOwnerEntitlement(patientCourseId, quantity);
        }
        case "BONUS" -> {
          db.update(
              "UPDATE patient_courses SET bonus_visits=bonus_visits-? WHERE id=?", quantity, patientCourseId);
          withdrawOwnerEntitlement(patientCourseId, quantity);
        }
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
    cancelSoldCourses(transactionId, actorUserId, reason);
    db.update(
        "INSERT INTO transaction_cancellations(transaction_id,reason_code,reason_text,cancelled_by)"
            + " VALUES(?,'USER_REQUEST',?,?)",
        transactionId, reason, actorUserId);

    return reader.get(transactionId);
  }

  /**
   * The owner's spendable balance mirrors the course's purchased and bonus
   * sessions, so taking those back has to come off the same row — otherwise
   * the balance row would still say the sessions were there to spend.
   */
  private void withdrawOwnerEntitlement(long patientCourseId, int quantity) {
    int rows =
        db.update(
            "UPDATE course_member_balances SET allocated_visits=allocated_visits-?,updated_at=now()"
                + " WHERE patient_course_id=? AND patient_id=(SELECT patient_id FROM patient_courses"
                + " WHERE id=?) AND allocated_visits-used_visits>=?",
            quantity, patientCourseId, patientCourseId, quantity);
    if (rows != 1)
      throw new IllegalArgumentException(
          "This sale cannot be voided: the course's sessions are no longer all on the owner's"
              + " balance (some were shared or used).");
  }

  /**
   * A course whose sale is voided is finished: no sessions were spent (the
   * void is refused otherwise), so it is refunded and drops out of commission.
   * If its month was already closed, its frozen pool is still counted as
   * outstanding for the seller, so the pool is written down to zero through
   * the same append-only adjustment a refund uses, and the fact that a closed
   * month's sales figure no longer holds is put on the audit log for Finance
   * to decide whether the seller's tier should be revisited — the closing
   * row itself is never edited.
   */
  private void cancelSoldCourses(long transactionId, Long actorUserId, String reason) {
    List<Map<String, Object>> sold =
        db.queryForList(
            "SELECT id,course_id,commission_status,monthly_closing_id,net_course_sale_amount,"
                + "seller_employee_id,sale_month,branch_id FROM"
                + " patient_courses WHERE sales_transaction_id=? AND visits_used=0 FOR UPDATE",
            transactionId);
    for (Map<String, Object> course : sold) {
      long courseId = ((Number) course.get("id")).longValue();
      boolean closed = "LOCKED".equals(course.get("commission_status"));
      BigDecimal poolWrittenDown = BigDecimal.ZERO;
      if (closed) {
        // Written off while still LOCKED: the pool math only applies to a frozen course.
        poolWrittenDown =
            adjustments.writeOffOutstandingPool(courseId, actorUserId, "Course sale voided: " + reason);
      }
      db.update(
          "UPDATE patient_courses SET status='REFUNDED',commission_status='CANCELLED' WHERE id=?",
          courseId);
      db.update(
          "UPDATE course_commission_splits SET commission_status='CANCELLED' WHERE patient_course_id=?",
          courseId);
      Map<String, Object> after = new java.util.LinkedHashMap<>();
      after.put("courseId", course.get("course_id"));
      after.put("status", "REFUNDED");
      after.put("commissionStatus", "CANCELLED");
      after.put("netCourseSaleAmount", course.get("net_course_sale_amount"));
      after.put("sellerEmployeeId", course.get("seller_employee_id"));
      after.put("saleMonth", String.valueOf(course.get("sale_month")));
      after.put("monthlyClosingId", course.get("monthly_closing_id"));
      after.put("poolWrittenDown", poolWrittenDown);
      after.put("closedMonthSalesAffected", closed);
      audit.record(
          actorUserId,
          course.get("branch_id") == null ? null : ((Number) course.get("branch_id")).longValue(),
          closed ? "COURSE_SALE_VOIDED_AFTER_CLOSE" : "COURSE_SALE_VOIDED",
          "patient_courses",
          String.valueOf(courseId),
          Map.of("commissionStatus", String.valueOf(course.get("commission_status"))),
          after,
          reason);
    }
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

  private static int remaining(Map<String, Object> patientCourse) {
    return intOf(patientCourse, "total_visits") + intOf(patientCourse, "bonus_visits")
        + intOf(patientCourse, "transfer_in_visits") - intOf(patientCourse, "visits_used")
        - intOf(patientCourse, "transfer_out_visits");
  }

  private static int intOf(Map<String, Object> row, String column) {
    Object value = row.get(column);
    return value == null ? 0 : ((Number) value).intValue();
  }

}
