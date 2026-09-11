package com.physiocare.clinic.commission;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Every correction to a frozen pool or a released allocation is append-only:
 * nothing here updates gross/owner-net figures on an existing
 * commission_allocations row (beyond flipping its status), and nothing
 * deletes history. A commission_adjustments row always explains the delta.
 */
@Service
public class CommissionAdjustmentService {
  private final JdbcTemplate db;
  private final CommissionAuditService audit;

  public CommissionAdjustmentService(JdbcTemplate db, CommissionAuditService audit) {
    this.db = db;
    this.audit = audit;
  }

  /**
   * A usage that turns out to have been a mistake (wrong patient, wrong
   * course, keyed in twice) is reversed exactly: if it was already allocated,
   * the allocation is flipped to REVERSED and a VOID_REVERSAL adjustment
   * books the exact opposite of what was released. This is for correcting an
   * erroneous entry — not the "keep the commission, it was a real visit"
   * refund case, which goes through {@link #reduceOutstandingPool}.
   */
  @Transactional
  public void reverseUsageForLedgerEntry(long ledgerEntryId, Long actorUserId, String reason) {
    List<Map<String, Object>> usages =
        db.queryForList(
            "SELECT id,status FROM course_usages WHERE course_ledger_entry_id=? AND status<>'REVERSED'",
            ledgerEntryId);
    for (Map<String, Object> usageRow : usages) {
      long usageId = ((Number) usageRow.get("id")).longValue();
      if ("ALLOCATED".equals(usageRow.get("status"))) {
        Map<String, Object> allocation =
            db.queryForMap(
                "SELECT * FROM commission_allocations WHERE course_usage_id=? FOR UPDATE", usageId);
        long allocationId = ((Number) allocation.get("id")).longValue();
        long patientCourseId = ((Number) allocation.get("patient_course_id")).longValue();
        BigDecimal gross = (BigDecimal) allocation.get("gross_commission_allocation");
        BigDecimal fee = (BigDecimal) allocation.get("treatment_fee_amount");
        BigDecimal ownerNet = (BigDecimal) allocation.get("owner_net_commission");
        BigDecimal topUp = (BigDecimal) allocation.get("company_top_up_amount");

        db.update(
            "UPDATE commission_allocations SET allocation_status='REVERSED' WHERE id=?", allocationId);
        long adjustmentId =
            db.queryForObject(
                "INSERT INTO commission_adjustments(patient_course_id,commission_allocation_id,"
                    + "adjustment_type,gross_amount,treatment_fee_amount,owner_net_amount,"
                    + "company_top_up_amount,reason,created_by) VALUES(?,?,'VOID_REVERSAL',?,?,?,?,?,?)"
                    + " RETURNING id",
                Long.class,
                patientCourseId,
                allocationId,
                gross.negate(),
                fee.negate(),
                ownerNet.negate(),
                topUp.negate(),
                reason,
                actorUserId);
        db.update(
            "UPDATE commission_allocations SET adjustment_reference_id=? WHERE id=?",
            adjustmentId,
            allocationId);
        db.update(
            "UPDATE patient_courses SET"
                + " gross_commission_allocated_total=gross_commission_allocated_total-?,"
                + " owner_net_commission_released_total=owner_net_commission_released_total-?,"
                + " substitute_treatment_fee_total=substitute_treatment_fee_total-? WHERE id=?",
            gross,
            ownerNet,
            fee,
            patientCourseId);
      }
      db.update(
          "UPDATE course_usages SET status='REVERSED', reversed_at=now(), reversed_by=?,"
              + " reversal_reason=? WHERE id=?",
          actorUserId,
          reason,
          usageId);
    }
  }

  /**
   * Cancels the unused remainder of a course — the Finance-policy answer to
   * "refund a course that already has usage on it" without touching a single
   * visit that already happened. Reduces total_visits, writes the ledger
   * entry the balance history needs to explain itself, and shrinks the
   * outstanding pool by the same portion.
   */
  @Transactional
  public void refundRemainingVisits(
      long patientCourseId,
      int visitsToCancel,
      long branchId,
      Long actorUserId,
      String actorName,
      String reason) {
    if (visitsToCancel <= 0) throw new IllegalArgumentException("Visits to cancel must be at least one");
    Map<String, Object> course =
        db.queryForMap("SELECT * FROM patient_courses WHERE id=? FOR UPDATE", patientCourseId);
    int totalVisits = ((Number) course.get("total_visits")).intValue();
    int visitsUsed = ((Number) course.get("visits_used")).intValue();
    int bonusVisits = ((Number) course.get("bonus_visits")).intValue();
    int transferIn = ((Number) course.get("transfer_in_visits")).intValue();
    int transferOut = ((Number) course.get("transfer_out_visits")).intValue();
    int remaining = totalVisits + bonusVisits + transferIn - visitsUsed - transferOut;
    if (visitsToCancel > remaining)
      throw new IllegalArgumentException("Cannot cancel more sessions than remain unused on this course");

    db.update("UPDATE patient_courses SET total_visits=total_visits-? WHERE id=?", visitsToCancel, patientCourseId);
    db.update(
        "INSERT INTO course_ledger_entries(patient_course_id,entry_type,quantity,balance_after,"
            + "branch_id,performed_by_name,created_by,reason) VALUES(?,'REFUND_REMAINING',?,?,?,?,?,?)",
        patientCourseId,
        -visitsToCancel,
        remaining - visitsToCancel,
        branchId,
        actorName,
        actorUserId,
        reason);
    db.update(
        "UPDATE patient_courses SET status = CASE"
            + "  WHEN status='REFUNDED' THEN 'REFUNDED'"
            + "  WHEN valid_until IS NOT NULL AND valid_until < CURRENT_DATE THEN 'EXPIRED'"
            + "  WHEN (total_visits+bonus_visits+transfer_in_visits-visits_used-transfer_out_visits)"
            + "       <= 0 THEN 'USED_UP'"
            + "  ELSE 'ACTIVE' END WHERE id=?",
        patientCourseId);

    reduceOutstandingPool(patientCourseId, visitsToCancel, actorUserId, reason);
    audit.record(actorUserId, branchId, "COURSE_REMAINING_REFUNDED", "patient_courses",
        String.valueOf(patientCourseId), null,
        Map.of("visits", visitsToCancel, "reason", reason), reason);
  }

  /**
   * Cancelling the unused remainder of a course after some sessions were
   * already delivered: the owner keeps every owner-net commission already
   * released (per Finance policy — a session that happened is not clawed
   * back), and only the outstanding, not-yet-allocated portion of the pool
   * shrinks. No existing allocation is touched.
   */
  @Transactional
  public BigDecimal reduceOutstandingPool(
      long patientCourseId, int visitsRemoved, Long actorUserId, String reason) {
    Map<String, Object> course =
        db.queryForMap("SELECT * FROM patient_courses WHERE id=? FOR UPDATE", patientCourseId);
    if (!"LOCKED".equals(course.get("commission_status"))) return BigDecimal.ZERO;
    BigDecimal perVisit = (BigDecimal) course.get("commission_allocation_per_visit");
    BigDecimal pool = (BigDecimal) course.get("total_course_commission_pool");
    if (perVisit == null || pool == null) return BigDecimal.ZERO;
    BigDecimal allocated = (BigDecimal) course.get("gross_commission_allocated_total");
    BigDecimal outstanding = pool.subtract(allocated).max(BigDecimal.ZERO);
    BigDecimal reduction = perVisit.multiply(BigDecimal.valueOf(visitsRemoved)).min(outstanding);
    if (reduction.signum() <= 0) return BigDecimal.ZERO;

    db.update(
        "UPDATE patient_courses SET total_course_commission_pool=total_course_commission_pool-?"
            + " WHERE id=?",
        reduction,
        patientCourseId);
    db.update(
        "INSERT INTO commission_adjustments(patient_course_id,adjustment_type,gross_amount,reason,"
            + "created_by) VALUES(?,'REFUND_POOL_REDUCTION',?,?,?)",
        patientCourseId,
        reduction.negate(),
        reason,
        actorUserId);
    return reduction;
  }
}
