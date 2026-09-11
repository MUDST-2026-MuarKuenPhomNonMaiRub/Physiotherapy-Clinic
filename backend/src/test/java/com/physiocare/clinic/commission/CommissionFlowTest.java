package com.physiocare.clinic.commission;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.server.ResponseStatusException;

/** Covers the PDF's acceptance criteria (section 29) against real PostgreSQL. */
class CommissionFlowTest extends AbstractCommissionIntegrationTest {

  @Autowired private CourseUsageService courseUsage;
  @Autowired private CommissionAllocationService allocationService;
  @Autowired private MonthlyCommissionClosingService closing;
  @Autowired private CommissionAdjustmentService adjustments;
  @Autowired private SharedCourseService sharedCourse;
  @Autowired private TreatmentFeeResolver feeResolver;

  private long use(long courseId, long patientId, int qty, LocalDate date, Long treatingId) {
    return courseUsage.recordCheckoutUsage(
        courseId, patientId, qty, 1L, null, treatingId, "Tester", null, date);
  }

  // ---- Case 1: Original Tier Must Persist ----------------------------------
  @Test
  void originalTierPersistsAfterLaterMonthSellsMore() {
    long seller = seedStaff("Dr A");
    long patient = seedPatient("Patient A");
    seedFlatScheme("T1_AUG", new BigDecimal("0.07"), null);
    long course = seedCourse(seller, seller, patient, new BigDecimal("10000"), 10, LocalDate.of(2026, 8, 15));

    closing.close(YearMonth.of(2026, 8), null);
    Map<String, Object> frozen = db.queryForMap("SELECT locked_commission_rate FROM patient_courses WHERE id=?", course);
    assertThat(((BigDecimal) frozen.get("locked_commission_rate")).stripTrailingZeros())
        .isEqualByComparingTo("0.07");

    // A much bigger September tier must not retroactively change August's course.
    seedFlatScheme("T1_SEP", new BigDecimal("0.30"), null);
    seedCourse(seller, seller, patient, new BigDecimal("500000"), 1, LocalDate.of(2026, 9, 1));
    Map<String, Object> stillFrozen = db.queryForMap("SELECT locked_commission_rate FROM patient_courses WHERE id=?", course);
    assertThat(((BigDecimal) stillFrozen.get("locked_commission_rate")).stripTrailingZeros())
        .isEqualByComparingTo("0.07");
  }

  // ---- Case 2: No New Sale, Old Course Still Releases ----------------------
  @Test
  void oldCourseStillReleasesWithNoNewSaleThisMonth() {
    long seller = seedStaff("Dr A");
    long patient = seedPatient("Patient A");
    seedFlatScheme("T2", new BigDecimal("0.07"), null);
    long course = seedCourse(seller, seller, patient, new BigDecimal("10000"), 10, LocalDate.of(2026, 8, 1));
    closing.close(YearMonth.of(2026, 8), null);

    // September: no new sale for this seller at all, but the August course still spends visits.
    long usageId = use(course, patient, 3, LocalDate.of(2026, 9, 5), seller);
    Map<String, Object> allocation = db.queryForMap("SELECT * FROM commission_allocations WHERE course_usage_id=?", usageId);
    assertThat((BigDecimal) allocation.get("gross_commission_allocation")).isEqualByComparingTo("210.00");
  }

  // ---- Case 5: Course Usage Limit -------------------------------------------
  @Test
  void usageIsRefusedPastRemainingBalance() {
    long seller = seedStaff("Dr A");
    long patient = seedPatient("Patient A");
    long course = seedCourse(seller, seller, patient, new BigDecimal("10000"), 3, LocalDate.of(2026, 8, 1));
    use(course, patient, 3, LocalDate.of(2026, 8, 2), seller);
    assertThatThrownBy(() -> use(course, patient, 1, LocalDate.of(2026, 8, 3), seller))
        .isInstanceOf(IllegalArgumentException.class);
  }

  // ---- Case 3/9: Substitute PT Fixed Fee ------------------------------------
  @Test
  void substitutePtFixedFeeSplitsGrossCorrectly() {
    long owner = seedStaff("Owner PT");
    long substitute = seedStaff("Substitute PT");
    long patient = seedPatient("Patient");
    seedFlatScheme("T3", new BigDecimal("0.07"), null);
    long course = seedCourse(owner, owner, patient, new BigDecimal("10000"), 10, LocalDate.of(2026, 8, 1));
    closing.close(YearMonth.of(2026, 8), null);

    db.update(
        "INSERT INTO treatment_fee_rules(version,employee_id,fee_type,fee_value,effective_from,active)"
            + " VALUES(1,?,'FIXED',45,'2020-01-01',true)",
        substitute);

    long usageId = use(course, patient, 1, LocalDate.of(2026, 8, 10), substitute);
    Map<String, Object> a = db.queryForMap("SELECT * FROM commission_allocations WHERE course_usage_id=?", usageId);
    assertThat((BigDecimal) a.get("gross_commission_allocation")).isEqualByComparingTo("70.00");
    assertThat((BigDecimal) a.get("treatment_fee_amount")).isEqualByComparingTo("45.00");
    assertThat((BigDecimal) a.get("owner_net_commission")).isEqualByComparingTo("25.00");
  }

  // ---- Case: Treating PT == Case Owner -> no substitute fee -----------------
  @Test
  void ownerTreatingThemselvesGetsFullGrossNoFee() {
    long owner = seedStaff("Owner PT");
    long patient = seedPatient("Patient");
    seedFlatScheme("T3B", new BigDecimal("0.07"), null);
    long course = seedCourse(owner, owner, patient, new BigDecimal("10000"), 10, LocalDate.of(2026, 8, 1));
    closing.close(YearMonth.of(2026, 8), null);

    long usageId = use(course, patient, 1, LocalDate.of(2026, 8, 10), owner);
    Map<String, Object> a = db.queryForMap("SELECT * FROM commission_allocations WHERE course_usage_id=?", usageId);
    assertThat((BigDecimal) a.get("treatment_fee_amount")).isEqualByComparingTo("0.00");
    assertThat((BigDecimal) a.get("owner_net_commission")).isEqualByComparingTo("70.00");
  }

  // ---- Case 10: Substitute PT Percentage Fee --------------------------------
  @Test
  void substitutePtPercentageFee() {
    long owner = seedStaff("Owner PT");
    long substitute = seedStaff("Substitute PT");
    long patient = seedPatient("Patient");
    seedFlatScheme("T10", new BigDecimal("0.07"), null);
    long course = seedCourse(owner, owner, patient, new BigDecimal("10000"), 10, LocalDate.of(2026, 8, 1));
    closing.close(YearMonth.of(2026, 8), null);

    db.update(
        "INSERT INTO treatment_fee_rules(version,employee_id,fee_type,fee_value,percentage_base,"
            + "effective_from,active) VALUES(1,?,'PERCENTAGE',3,'COURSE_VALUE_PER_VISIT','2020-01-01',true)",
        substitute);

    long usageId = use(course, patient, 1, LocalDate.of(2026, 8, 10), substitute);
    Map<String, Object> a = db.queryForMap("SELECT * FROM commission_allocations WHERE course_usage_id=?", usageId);
    // Course value / visit = 1,000; fee = 3% of 1,000 = 30; owner net = 70-30 = 40.
    assertThat((BigDecimal) a.get("treatment_fee_amount")).isEqualByComparingTo("30.00");
    assertThat((BigDecimal) a.get("owner_net_commission")).isEqualByComparingTo("40.00");
  }

  // ---- Case 11 + overflow policies -------------------------------------------
  @Test
  void overflowCapAtCommission() {
    long owner = seedStaff("Owner PT");
    long substitute = seedStaff("Substitute PT");
    long patient = seedPatient("Patient");
    seedFlatScheme("T11A", new BigDecimal("0.04"), "CAP_AT_COMMISSION"); // gross/visit = 40
    long course = seedCourse(owner, owner, patient, new BigDecimal("10000"), 10, LocalDate.of(2026, 8, 1));
    closing.close(YearMonth.of(2026, 8), null);
    db.update(
        "INSERT INTO treatment_fee_rules(version,employee_id,fee_type,fee_value,effective_from,active)"
            + " VALUES(1,?,'FIXED',60,'2020-01-01',true)",
        substitute);

    long usageId = use(course, patient, 1, LocalDate.of(2026, 8, 10), substitute);
    Map<String, Object> a = db.queryForMap("SELECT * FROM commission_allocations WHERE course_usage_id=?", usageId);
    assertThat((BigDecimal) a.get("gross_commission_allocation")).isEqualByComparingTo("40.00");
    assertThat((BigDecimal) a.get("treatment_fee_amount")).isEqualByComparingTo("40.00"); // capped
    assertThat((BigDecimal) a.get("owner_net_commission")).isEqualByComparingTo("0.00");
    assertThat((BigDecimal) a.get("owner_net_commission")).isNotNegative();
  }

  @Test
  void overflowCompanyTopUp() {
    long owner = seedStaff("Owner PT");
    long substitute = seedStaff("Substitute PT");
    long patient = seedPatient("Patient");
    seedFlatScheme("T11B", new BigDecimal("0.04"), "COMPANY_TOP_UP"); // gross/visit = 40
    long course = seedCourse(owner, owner, patient, new BigDecimal("10000"), 10, LocalDate.of(2026, 8, 1));
    closing.close(YearMonth.of(2026, 8), null);
    db.update(
        "INSERT INTO treatment_fee_rules(version,employee_id,fee_type,fee_value,effective_from,active)"
            + " VALUES(1,?,'FIXED',60,'2020-01-01',true)",
        substitute);

    long usageId = use(course, patient, 1, LocalDate.of(2026, 8, 10), substitute);
    Map<String, Object> a = db.queryForMap("SELECT * FROM commission_allocations WHERE course_usage_id=?", usageId);
    assertThat((BigDecimal) a.get("treatment_fee_amount")).isEqualByComparingTo("60.00");
    assertThat((BigDecimal) a.get("company_top_up_amount")).isEqualByComparingTo("20.00");
    assertThat((BigDecimal) a.get("owner_net_commission")).isEqualByComparingTo("0.00");
  }

  @Test
  void overflowBlockAndRequireApprovalThrows() {
    long owner = seedStaff("Owner PT");
    long substitute = seedStaff("Substitute PT");
    long patient = seedPatient("Patient");
    seedFlatScheme("T11C", new BigDecimal("0.04"), "BLOCK_AND_REQUIRE_APPROVAL"); // gross/visit = 40
    long course = seedCourse(owner, owner, patient, new BigDecimal("10000"), 10, LocalDate.of(2026, 8, 1));
    closing.close(YearMonth.of(2026, 8), null);
    db.update(
        "INSERT INTO treatment_fee_rules(version,employee_id,fee_type,fee_value,effective_from,active)"
            + " VALUES(1,?,'FIXED',60,'2020-01-01',true)",
        substitute);

    assertThatThrownBy(() -> use(course, patient, 1, LocalDate.of(2026, 8, 10), substitute))
        .isInstanceOf(ResponseStatusException.class);
  }

  // ---- Case 4: Shared Course -------------------------------------------------
  @Test
  void sharedCourseUsesOneBalanceNoNewCommission() {
    long owner = seedStaff("Owner PT");
    long patientA = seedPatient("Patient A");
    long patientB = seedPatient("Patient B");
    seedFlatScheme("T4", new BigDecimal("0.07"), null);
    long course = seedCourse(owner, owner, patientA, new BigDecimal("10000"), 10, LocalDate.of(2026, 8, 1));
    closing.close(YearMonth.of(2026, 8), null);

    sharedCourse.addMember(course, patientB, 4);
    use(course, patientA, 6, LocalDate.of(2026, 8, 5), owner);
    use(course, patientB, 4, LocalDate.of(2026, 8, 6), owner);

    Map<String, Object> updated = db.queryForMap("SELECT * FROM patient_courses WHERE id=?", course);
    assertThat(((Number) updated.get("visits_used")).intValue()).isEqualTo(10);
    assertThat((BigDecimal) updated.get("gross_commission_allocated_total"))
        .isEqualByComparingTo((BigDecimal) updated.get("total_course_commission_pool"));
    // No second course/sale was ever created for patient B.
    Long coursesForB =
        db.queryForObject("SELECT count(*) FROM patient_courses WHERE patient_id=?", Long.class, patientB);
    assertThat(coursesForB).isZero();
  }

  // ---- Rounding invariant: sum of allocations never exceeds, equals pool when fully used ----
  @Test
  void allocationsNeverExceedPoolAndReconcileWhenFullyUsed() {
    long owner = seedStaff("Owner PT");
    long patient = seedPatient("Patient");
    seedFlatScheme("T_ROUND", new BigDecimal("0.07"), null); // pool = 700, /3 visits = 233.33...
    long course = seedCourse(owner, owner, patient, new BigDecimal("10000"), 3, LocalDate.of(2026, 8, 1));
    closing.close(YearMonth.of(2026, 8), null);

    use(course, patient, 1, LocalDate.of(2026, 8, 2), owner);
    use(course, patient, 1, LocalDate.of(2026, 8, 3), owner);
    use(course, patient, 1, LocalDate.of(2026, 8, 4), owner);

    Map<String, Object> updated = db.queryForMap("SELECT * FROM patient_courses WHERE id=?", course);
    assertThat((BigDecimal) updated.get("gross_commission_allocated_total"))
        .isEqualByComparingTo((BigDecimal) updated.get("total_course_commission_pool"));
  }

  // ---- Void before allocation (still PENDING_RATE) --------------------------
  @Test
  void voidingUsageBeforeAllocationJustReversesTheUsage() {
    long owner = seedStaff("Owner PT");
    long patient = seedPatient("Patient");
    long course = seedCourse(owner, owner, patient, new BigDecimal("10000"), 10, LocalDate.of(2026, 8, 1));
    // Course is still PROVISIONAL (not closed yet) -> usage stays PENDING_RATE.
    long usageId = use(course, patient, 1, LocalDate.of(2026, 8, 2), owner);
    Long ledgerEntryId =
        db.queryForObject("SELECT course_ledger_entry_id FROM course_usages WHERE id=?", Long.class, usageId);

    adjustments.reverseUsageForLedgerEntry(ledgerEntryId, seedActorUserId(), "test void");
    String status = db.queryForObject("SELECT status FROM course_usages WHERE id=?", String.class, usageId);
    assertThat(status).isEqualTo("REVERSED");
    Long adjustmentCount =
        db.queryForObject("SELECT count(*) FROM commission_adjustments WHERE patient_course_id=?", Long.class, course);
    assertThat(adjustmentCount).isZero(); // never allocated, nothing to book
  }

  // ---- Void after allocation: exact reversal, no clawback of unrelated visits ----
  @Test
  void voidingAllocatedUsageBooksExactReversal() {
    long owner = seedStaff("Owner PT");
    long patient = seedPatient("Patient");
    seedFlatScheme("T_VOID", new BigDecimal("0.07"), null);
    long course = seedCourse(owner, owner, patient, new BigDecimal("10000"), 10, LocalDate.of(2026, 8, 1));
    closing.close(YearMonth.of(2026, 8), null);

    long usageId = use(course, patient, 1, LocalDate.of(2026, 8, 2), owner);
    Long ledgerEntryId =
        db.queryForObject("SELECT course_ledger_entry_id FROM course_usages WHERE id=?", Long.class, usageId);

    Map<String, Object> before = db.queryForMap("SELECT * FROM patient_courses WHERE id=?", course);
    adjustments.reverseUsageForLedgerEntry(ledgerEntryId, seedActorUserId(), "keyed in by mistake");
    Map<String, Object> after = db.queryForMap("SELECT * FROM patient_courses WHERE id=?", course);

    assertThat((BigDecimal) after.get("gross_commission_allocated_total"))
        .isEqualByComparingTo(((BigDecimal) before.get("gross_commission_allocated_total")).subtract(new BigDecimal("70.00")));
    assertThat(
            db.queryForObject(
                "SELECT allocation_status FROM commission_allocations WHERE course_usage_id=?",
                String.class,
                usageId))
        .isEqualTo("REVERSED");
  }

  // ---- Refund the unused remainder keeps commission already released --------
  @Test
  void refundRemainingVisitsKeepsOwnerNetAlreadyReleased() {
    long owner = seedStaff("Owner PT");
    long patient = seedPatient("Patient");
    seedFlatScheme("T_REFUND", new BigDecimal("0.07"), null);
    long course = seedCourse(owner, owner, patient, new BigDecimal("10000"), 10, LocalDate.of(2026, 8, 1));
    closing.close(YearMonth.of(2026, 8), null);
    use(course, patient, 3, LocalDate.of(2026, 8, 5), owner);

    Map<String, Object> beforeRefund = db.queryForMap("SELECT * FROM patient_courses WHERE id=?", course);
    BigDecimal ownerNetBefore = (BigDecimal) beforeRefund.get("owner_net_commission_released_total");

    adjustments.refundRemainingVisits(course, 7, 1L, seedActorUserId(), "Tester", "patient stopped treatment");

    Map<String, Object> after = db.queryForMap("SELECT * FROM patient_courses WHERE id=?", course);
    assertThat((BigDecimal) after.get("owner_net_commission_released_total")).isEqualByComparingTo(ownerNetBefore);
    assertThat((BigDecimal) after.get("total_course_commission_pool")).isEqualByComparingTo("210.00"); // 700 - 7*70
    assertThat(((Number) after.get("total_visits")).intValue()).isEqualTo(3);

    assertThatThrownBy(() -> adjustments.refundRemainingVisits(course, 1, 1L, seedActorUserId(), "Tester", "too many"))
        .isInstanceOf(IllegalArgumentException.class);
  }

  // ---- Employee resignation: forfeit vs continue -----------------------------
  @Test
  void terminationPolicyForfeitZeroesOwnerNet() {
    long owner = seedStaff("Owner PT");
    long patient = seedPatient("Patient");
    seedFlatScheme("T_TERM", new BigDecimal("0.07"), null);
    long course = seedCourse(owner, owner, patient, new BigDecimal("10000"), 10, LocalDate.of(2026, 8, 1));
    closing.close(YearMonth.of(2026, 8), null);
    db.update(
        "UPDATE staff SET termination_date='2026-08-05', commission_after_termination_policy="
            + "'FORFEIT_AFTER_TERMINATION' WHERE id=?",
        owner);

    long usageId = use(course, patient, 1, LocalDate.of(2026, 8, 10), owner);
    Map<String, Object> a = db.queryForMap("SELECT * FROM commission_allocations WHERE course_usage_id=?", usageId);
    assertThat((BigDecimal) a.get("owner_net_commission")).isEqualByComparingTo("0.00");
  }

  @Test
  void terminationPolicyContinueStillPaysOut() {
    long owner = seedStaff("Owner PT");
    long patient = seedPatient("Patient");
    seedFlatScheme("T_TERM2", new BigDecimal("0.07"), null);
    long course = seedCourse(owner, owner, patient, new BigDecimal("10000"), 10, LocalDate.of(2026, 8, 1));
    closing.close(YearMonth.of(2026, 8), null);
    db.update(
        "UPDATE staff SET termination_date='2026-08-05', commission_after_termination_policy="
            + "'CONTINUE_UNTIL_COURSE_END' WHERE id=?",
        owner);

    long usageId = use(course, patient, 1, LocalDate.of(2026, 8, 10), owner);
    Map<String, Object> a = db.queryForMap("SELECT * FROM commission_allocations WHERE course_usage_id=?", usageId);
    assertThat((BigDecimal) a.get("owner_net_commission")).isEqualByComparingTo("70.00");
  }

  // ---- Legacy-excluded course never gets allocated ---------------------------
  @Test
  void legacyExcludedCourseUsageNeverAllocates() {
    long owner = seedStaff("Owner PT");
    long patient = seedPatient("Patient");
    long course = seedCourse(owner, owner, patient, new BigDecimal("10000"), 10, LocalDate.of(2026, 6, 1));
    db.update("UPDATE patient_courses SET commission_status='LEGACY_EXCLUDED' WHERE id=?", course);

    long usageId = use(course, patient, 1, LocalDate.of(2026, 8, 10), owner);
    String status = db.queryForObject("SELECT status FROM course_usages WHERE id=?", String.class, usageId);
    assertThat(status).isEqualTo("LEGACY_UNALLOCATED");
    Long allocationCount =
        db.queryForObject("SELECT count(*) FROM commission_allocations WHERE course_usage_id=?", Long.class, usageId);
    assertThat(allocationCount).isZero();
  }

  // ---- Idempotent close: closing the same month twice does not double-process ----
  @Test
  void closingTheSameMonthTwiceIsIdempotent() {
    long seller = seedStaff("Dr A");
    long patient = seedPatient("Patient A");
    seedFlatScheme("T_IDEMPOTENT", new BigDecimal("0.07"), null);
    seedCourse(seller, seller, patient, new BigDecimal("10000"), 10, LocalDate.of(2026, 8, 1));

    int firstRun = closing.close(YearMonth.of(2026, 8), null);
    int secondRun = closing.close(YearMonth.of(2026, 8), null);
    assertThat(firstRun).isEqualTo(1);
    assertThat(secondRun).isEqualTo(0);
    Long closingRows =
        db.queryForObject(
            "SELECT count(*) FROM monthly_commission_closings WHERE closing_month='2026-08-01' AND"
                + " employee_id=?",
            Long.class,
            seller);
    assertThat(closingRows).isEqualTo(1);
  }

  // ---- Duplicate checkout usage (idempotency key) is not double-charged ------
  @Test
  void duplicateCheckoutUsageIsNotDoubleCounted() {
    long owner = seedStaff("Owner PT");
    long patient = seedPatient("Patient");
    long course = seedCourse(owner, owner, patient, new BigDecimal("10000"), 10, LocalDate.of(2026, 8, 1));

    long transactionId = insertBareTransaction(patient);
    long first = courseUsage.recordCheckoutUsage(course, patient, 1, 1L, transactionId, owner, "Tester", null, LocalDate.of(2026, 8, 5));
    long second = courseUsage.recordCheckoutUsage(course, patient, 1, 1L, transactionId, owner, "Tester", null, LocalDate.of(2026, 8, 5));

    assertThat(second).isEqualTo(first);
    Integer visitsUsed = db.queryForObject("SELECT visits_used FROM patient_courses WHERE id=?", Integer.class, course);
    assertThat(visitsUsed).isEqualTo(1);
  }

  // ---- Treatment fee resolver specificity ------------------------------------
  @Test
  void resolverPicksMostSpecificRuleFirst() {
    long employee = seedStaff("PT");
    long owner = seedStaff("Owner");
    db.update(
        "INSERT INTO treatment_fee_rules(version,fee_type,fee_value,effective_from,active) VALUES"
            + "(1,'FIXED',20,'2020-01-01',true)"); // global default
    db.update(
        "INSERT INTO treatment_fee_rules(version,employee_id,fee_type,fee_value,effective_from,active)"
            + " VALUES(1,?,'FIXED',45,'2020-01-01',true)",
        employee); // employee-specific, should win

    var resolution = feeResolver.resolve(employee, owner, null, LocalDate.of(2026, 8, 1));
    assertThat(resolution).isPresent();
    assertThat(resolution.get().feeValue()).isEqualByComparingTo("45");
  }

  @Test
  void resolverReturnsEmptyWhenTreatingIsOwner() {
    long owner = seedStaff("Owner");
    assertThat(feeResolver.resolve(owner, owner, null, LocalDate.of(2026, 8, 1))).isEmpty();
  }

  private long insertBareTransaction(long patientId) {
    return db.queryForObject(
        "INSERT INTO sales_transactions(transaction_no,patient_id,branch_id,transaction_type,"
            + "status,subtotal,total_amount) VALUES(?,?,1,'COURSE_USAGE','PAID',0,0) RETURNING id",
        Long.class,
        "TEST-" + nextId(),
        patientId);
  }
}
