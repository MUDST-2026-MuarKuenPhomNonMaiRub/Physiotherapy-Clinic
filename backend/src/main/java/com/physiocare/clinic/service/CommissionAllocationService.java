package com.physiocare.clinic.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * Turns one {@code course_usages} row into a {@code commission_allocations}
 * row, once the course's rate is frozen. This is the only place gross
 * commission is computed for a visit, so the "sum of allocations never
 * exceeds the pool" invariant lives in one formula: gross is always the
 * smaller of (visit_qty × per-visit) and what is actually still outstanding.
 * Once a course's outstanding pool reaches zero, further usage (from bonus or
 * transferred-in visits) simply earns nothing more — it does not go negative
 * and it does not create a new pool.
 */
@Service
public class CommissionAllocationService {
  private final JdbcTemplate db;
  private final TreatmentFeeResolver feeResolver;

  public CommissionAllocationService(JdbcTemplate db, TreatmentFeeResolver feeResolver) {
    this.db = db;
    this.feeResolver = feeResolver;
  }

  @Transactional
  public void allocate(long usageId) {
    Map<String, Object> usage = db.queryForMap("SELECT * FROM course_usages WHERE id=? FOR UPDATE", usageId);
    if (!"PENDING_RATE".equals(usage.get("status"))) return; // already allocated/reversed — nothing to do

    long patientCourseId = ((Number) usage.get("patient_course_id")).longValue();
    Map<String, Object> course =
        db.queryForMap("SELECT * FROM patient_courses WHERE id=? FOR UPDATE", patientCourseId);
    Long splitId = usage.get("course_commission_split_id") == null
        ? null
        : ((Number) usage.get("course_commission_split_id")).longValue();
    Map<String, Object> split = splitId == null
        ? null
        : db.queryForMap("SELECT * FROM course_commission_splits WHERE id=? FOR UPDATE", splitId);
    String status = split == null
        ? (String) course.get("commission_status")
        : (String) split.get("commission_status");
    if (!"LOCKED".equals(status))
      throw new IllegalStateException("Course commission owner split is not locked yet — cannot allocate");

    BigDecimal perVisit = (BigDecimal) (split == null
        ? course.get("commission_allocation_per_visit")
        : split.get("commission_allocation_per_visit"));
    BigDecimal pool = (BigDecimal) (split == null
        ? course.get("total_course_commission_pool")
        : split.get("total_commission_pool"));
    BigDecimal allocatedSoFar = (BigDecimal) (split == null
        ? course.get("gross_commission_allocated_total")
        : split.get("gross_commission_allocated_total"));
    if (perVisit == null || pool == null) {
      // A locked course with no pool (e.g. legacy data, or a zero-price
      // transfer target) earns nothing — mark the usage settled either way.
      db.update("UPDATE course_usages SET status='ALLOCATED' WHERE id=?", usageId);
      return;
    }
    int qty = ((Number) usage.get("quantity")).intValue();
    BigDecimal remainingOutstanding = pool.subtract(allocatedSoFar).max(BigDecimal.ZERO);
    int commissionableVisits = split == null
        ? (course.get("commissionable_visit_count") != null
            ? ((Number) course.get("commissionable_visit_count")).intValue()
            : ((Number) course.get("total_visits")).intValue())
        : ((Number) split.get("allocated_visits")).intValue();
    // Truncating per-visit to 2dp (done once, at close) always leaves a few
    // cents of the pool unassigned by the time every commissionable visit is
    // spent — floor(pool/n) * n <= pool, with equality only when pool divides
    // evenly. Whichever usage crosses the commissionable-visit-count boundary
    // claims the whole remainder instead of just its own qty * per-visit
    // share, so the pool always reconciles to zero exactly when fully used,
    // and never goes negative before that.
    Integer consumedBefore = splitId == null
        ? db.queryForObject(
            "SELECT COALESCE(sum(visit_qty),0) FROM commission_allocations WHERE"
                + " patient_course_id=? AND course_commission_split_id IS NULL"
                + " AND allocation_status='ALLOCATED'",
            Integer.class,
            patientCourseId)
        : db.queryForObject(
            "SELECT COALESCE(sum(visit_qty),0) FROM commission_allocations WHERE"
                + " course_commission_split_id=? AND allocation_status='ALLOCATED'",
            Integer.class,
            splitId);
    boolean isLastCommissionableChunk = consumedBefore + qty >= commissionableVisits;
    BigDecimal gross =
        isLastCommissionableChunk
            ? remainingOutstanding
            : perVisit.multiply(BigDecimal.valueOf(qty)).min(remainingOutstanding);

    long treatingId = ((Number) usage.get("treating_employee_id")).longValue();
    long ownerId = ((Number) usage.get("case_owner_employee_id")).longValue();
    LocalDate visitDate = ((java.sql.Date) usage.get("usage_date")).toLocalDate();

    BigDecimal fee = BigDecimal.ZERO;
    BigDecimal topUp = BigDecimal.ZERO;
    Long ruleId = null;
    String feeType = null;
    BigDecimal feeRateOrAmount = null;
    BigDecimal feeBase = null;

    Optional<TreatmentFeeResolver.Resolution> resolution =
        treatingId == ownerId
            ? Optional.empty()
            : feeResolver.resolve(treatingId, ownerId, serviceIdForUsage(usage), visitDate);
    if (resolution.isPresent()) {
      TreatmentFeeResolver.Resolution rule = resolution.get();
      ruleId = rule.ruleId();
      feeType = rule.feeType();
      feeRateOrAmount = rule.feeValue();

      BigDecimal fullPriceCredit = split == null
          ? (BigDecimal) course.get("course_price")
          : (BigDecimal) split.get("sales_credit_amount");
      feeBase =
          commissionableVisits > 0
              ? fullPriceCredit.divide(BigDecimal.valueOf(commissionableVisits), 8, RoundingMode.HALF_UP)
              : BigDecimal.ZERO;

      fee =
          "PERCENTAGE".equals(feeType)
              ? feeBase.multiply(feeRateOrAmount).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP)
                  .multiply(BigDecimal.valueOf(qty))
              : feeRateOrAmount.multiply(BigDecimal.valueOf(qty));

      if (fee.compareTo(gross) > 0) {
        String overflowPolicy = overflowPolicyFor(course);
        switch (overflowPolicy) {
          case "BLOCK_AND_REQUIRE_APPROVAL" -> throw new ResponseStatusException(
              HttpStatus.UNPROCESSABLE_ENTITY,
              "Treatment fee exceeds the commission allocation for this visit and requires approval");
          case "COMPANY_TOP_UP" -> topUp = fee.subtract(gross);
          default -> fee = gross; // CAP_AT_COMMISSION, and the safe default for an unrecognised policy
        }
      }
    }
    BigDecimal ownerNet = gross.subtract(fee).max(BigDecimal.ZERO);
    if (isForfeitedByTermination(ownerId, visitDate)) ownerNet = BigDecimal.ZERO;

    db.update(
        "INSERT INTO commission_allocations(visit_id,patient_course_id,patient_id,"
            + "case_owner_employee_id,treating_employee_id,visit_date,gross_commission_allocation,"
            + "treatment_fee_rule_id,treatment_fee_type,treatment_fee_rate_or_amount,"
            + "treatment_fee_calculation_base,treatment_fee_amount,owner_net_commission,"
            + "company_top_up_amount,overflow_policy_used,course_usage_id,visit_qty,created_by,"
            + "course_commission_split_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        usage.get("visit_id"),
        patientCourseId,
        usage.get("patient_id"),
        ownerId,
        treatingId,
        visitDate,
        gross,
        ruleId,
        feeType,
        feeRateOrAmount,
        feeBase,
        fee,
        ownerNet,
        topUp,
        resolution.isPresent() ? overflowPolicyFor(course) : null,
        usageId,
        qty,
        usage.get("created_by"),
        splitId);

    db.update("UPDATE course_usages SET status='ALLOCATED' WHERE id=?", usageId);
    db.update(
        "UPDATE patient_courses SET"
            + " gross_commission_allocated_total=gross_commission_allocated_total+?,"
            + " owner_net_commission_released_total=owner_net_commission_released_total+?,"
            + " substitute_treatment_fee_total=substitute_treatment_fee_total+? WHERE id=?",
        gross,
        ownerNet,
        fee,
        patientCourseId);
    if (splitId != null) {
      db.update(
          "UPDATE course_commission_splits SET"
              + " gross_commission_allocated_total=gross_commission_allocated_total+?,"
              + " owner_net_commission_released_total=owner_net_commission_released_total+?,"
              + " substitute_treatment_fee_total=substitute_treatment_fee_total+? WHERE id=?",
          gross,
          ownerNet,
          fee,
          splitId);
    }
  }

  /**
   * Section 21 of the requirement: an owner who left before this visit only
   * loses the owner-net release when their record is set to
   * FORFEIT_AFTER_TERMINATION — the default, CONTINUE_UNTIL_COURSE_END, pays
   * out exactly as if they were still on staff.
   */
  private boolean isForfeitedByTermination(long ownerId, LocalDate visitDate) {
    List<Map<String, Object>> rows =
        db.queryForList(
            "SELECT termination_date, commission_after_termination_policy FROM staff WHERE id=?",
            ownerId);
    if (rows.isEmpty()) return false;
    Map<String, Object> staff = rows.get(0);
    java.sql.Date terminationDate = (java.sql.Date) staff.get("termination_date");
    if (terminationDate == null || !terminationDate.toLocalDate().isBefore(visitDate)) return false;
    return "FORFEIT_AFTER_TERMINATION".equals(staff.get("commission_after_termination_policy"));
  }

  private String overflowPolicyFor(Map<String, Object> course) {
    if (course.get("overflow_policy_snapshot") != null)
      return (String) course.get("overflow_policy_snapshot");
    Object schemeId = course.get("commission_scheme_id");
    if (schemeId == null) return "CAP_AT_COMMISSION";
    return db.queryForList(
            "SELECT overflow_policy FROM commission_schemes WHERE id=?", String.class, schemeId)
        .stream()
        .findFirst()
        .orElse("CAP_AT_COMMISSION");
  }

  private Long serviceIdForUsage(Map<String, Object> usage) {
    Object visitId = usage.get("visit_id");
    if (visitId == null) return null;
    return db.queryForList(
            "SELECT a.service_id FROM visits v JOIN appointments a ON a.id=v.appointment_id"
                + " WHERE v.id=?",
            Long.class,
            ((Number) visitId).longValue())
        .stream()
        .findFirst()
        .orElse(null);
  }
}
