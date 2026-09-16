package com.physiocare.clinic.commission;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.physiocare.clinic.checkout.CheckoutDtos;
import com.physiocare.clinic.checkout.CheckoutService;
import com.physiocare.clinic.checkout.CourseTransferController;
import com.physiocare.clinic.report.ReportService;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.server.ResponseStatusException;

/** Covers the PDF's acceptance criteria (section 29) against real PostgreSQL. */
class CommissionFlowTest extends AbstractCommissionIntegrationTest {

  @Autowired private CourseUsageService courseUsage;
  @Autowired private CommissionAllocationService allocationService;
  @Autowired private MonthlyCommissionClosingService closing;
  @Autowired private CommissionAdjustmentService adjustments;
  @Autowired private SharedCourseService sharedCourse;
  @Autowired private TreatmentFeeResolver feeResolver;
  @Autowired private CommissionQueryService commissionQueries;
  @Autowired private CheckoutService checkout;
  @Autowired private CommissionSettingsService settings;
  @Autowired private CourseTransferController transfers;

  @Autowired private ReportService legacyReports;

  private long use(long courseId, long patientId, int qty, LocalDate date, Long treatingId) {
    return courseUsage.recordCheckoutUsage(
        courseId, patientId, qty, 1L, null, treatingId, "Tester", null, date);
  }

  @Test
  void legacyCommissionReportAttributesOwnerAndTreatingAndKeepsCheckoutOnlyAllocation() {
    long owner = seedStaff("Legacy Owner");
    long treating = seedStaff("Legacy Treating");
    long patient = seedPatient("Legacy Report Patient");
    long course = seedCourse(owner, owner, patient, new BigDecimal("10000"), 10, LocalDate.of(2026, 9, 1));
    db.update(
        "INSERT INTO commission_allocations(visit_id,patient_course_id,patient_id,case_owner_employee_id,"
            + "treating_employee_id,visit_date,gross_commission_allocation,treatment_fee_amount,owner_net_commission,"
            + "course_usage_id,visit_qty,allocation_status) VALUES(NULL,?,?,?,?,?,100,30,70,NULL,1,'ALLOCATED')",
        course, patient, owner, treating, LocalDate.of(2026, 9, 10));

    Authentication admin = new UsernamePasswordAuthenticationToken("admin", "n/a",
        List.of(new SimpleGrantedAuthority("ROLE_ADMIN"), new SimpleGrantedAuthority("report.view")));
    SecurityContextHolder.getContext().setAuthentication(admin);
    List<Map<String, Object>> rows = (List<Map<String, Object>>) legacyReports.commissions(
        LocalDate.of(2026, 9, 1), LocalDate.of(2026, 9, 30), 1L, admin);

    assertThat(rows).extracting(r -> ((Number) r.get("treating_employee_id")).longValue())
        .containsExactlyInAnyOrder(owner, treating);
    Map<String, Object> ownerRow = rows.stream().filter(r -> ((Number) r.get("treating_employee_id")).longValue() == owner).findFirst().orElseThrow();
    Map<String, Object> treatingRow = rows.stream().filter(r -> ((Number) r.get("treating_employee_id")).longValue() == treating).findFirst().orElseThrow();
    assertThat((BigDecimal) ownerRow.get("owner_net")).isEqualByComparingTo("70");
    assertThat((BigDecimal) ownerRow.get("treatment_fee")).isEqualByComparingTo("0");
    assertThat((BigDecimal) treatingRow.get("owner_net")).isEqualByComparingTo("0");
    assertThat((BigDecimal) treatingRow.get("treatment_fee")).isEqualByComparingTo("30");
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

  @Test
  void appointmentUsageLinksTheCompletedVisitAndAllocatesTheCourseCommission() {
    long owner = seedStaff("Appointment PT");
    long patient = seedPatient("Appointment Patient");
    seedFlatScheme("T_APPOINTMENT", new BigDecimal("0.07"), null);
    long course = seedCourse(owner, owner, patient, new BigDecimal("10000"), 10, LocalDate.of(2026, 8, 1));
    closing.close(YearMonth.of(2026, 8), null);

    long appointmentId = nextId();
    long visitId = nextId();
    long serviceId = db.queryForObject("SELECT id FROM services LIMIT 1", Long.class);
    db.update(
        "INSERT INTO appointments(id,appointment_no,patient_id,branch_id,provider_staff_id,service_id,"
            + "starts_at,ends_at,status) VALUES(?,?,?,?,?,?,'2026-09-10 10:00:00+07','2026-09-10 10:30:00+07','COMPLETED')",
        appointmentId, "AP-TEST-" + appointmentId, patient, 1L, owner, serviceId);
    db.update(
        "INSERT INTO visits(id,appointment_id,patient_id,branch_id,treating_staff_id,completed_at,status)"
            + " VALUES(?,?,?,?,?,now(),'COMPLETED')",
        visitId, appointmentId, patient, 1L, owner);

    long usageId = courseUsage.recordAppointmentUsage(
        course, patient, 1, 1L, appointmentId, owner, "Tester", null, LocalDate.of(2026, 9, 10));
    Map<String, Object> allocation = db.queryForMap(
        "SELECT * FROM commission_allocations WHERE course_usage_id=?", usageId);
    assertThat(((Number) allocation.get("visit_id")).longValue()).isEqualTo(visitId);
    assertThat((BigDecimal) allocation.get("gross_commission_allocation")).isEqualByComparingTo("70.00");
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
    assertThat(db.queryForObject(
        "SELECT allocated_visits FROM course_member_balances WHERE patient_course_id=? AND patient_id=?",
        Integer.class, course, patient)).isEqualTo(3);

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

  // ---- Checkout integration: a zero-price usage still completes -------------
  @Test
  void zeroPriceCourseUsageCompletesWithoutCreatingPayment() {
    long owner = seedStaff("Checkout Owner");
    long patient = seedPatient("Checkout Patient");
    long course = seedCourse(owner, owner, patient, new BigDecimal("10000"), 10, LocalDate.of(2026, 8, 1));
    long branch = activeBranchId();
    long cash = db.queryForObject("SELECT id FROM payment_methods WHERE code='CASH'", Long.class);
    long paymentsBefore = db.queryForObject("SELECT count(*) FROM payments", Long.class);

    CheckoutDtos.TransactionView result =
        checkout.checkout(
            new CheckoutDtos.CheckoutRequest(
                patient, branch, null, null, null, course, 1, false, owner, null, cash, null,
                null, null, null, List.of()),
            adminAuthentication());

    assertThat(result.total()).isEqualByComparingTo("0.00");
    assertThat(result.patientCourseId()).isEqualTo(course);
    assertThat(db.queryForObject("SELECT count(*) FROM payments", Long.class))
        .isEqualTo(paymentsBefore);
    assertThat(db.queryForObject("SELECT visits_used FROM patient_courses WHERE id=?", Integer.class, course))
        .isEqualTo(1);
  }

  // ---- Checkout integration: sale -> provisional pool -> monthly close ------
  @Test
  void coursePurchaseCreatesProvisionalPoolAndClosesWithFrozenRate() {
    long seller = seedStaff("Course Seller");
    long treating = seedStaff("Course Therapist");
    long patient = seedPatient("Course Buyer");
    long branch = activeBranchId();
    seedFlatScheme("T_CHECKOUT_PURCHASE", new BigDecimal("0.07"), null);
    long courseTemplate = db.queryForObject("SELECT id FROM courses LIMIT 1", Long.class);
    BigDecimal price = db.queryForObject("SELECT price FROM courses WHERE id=?", BigDecimal.class, courseTemplate);
    long cash = db.queryForObject("SELECT id FROM payment_methods WHERE code='CASH'", Long.class);

    CheckoutDtos.TransactionView sale =
        checkout.checkout(
            new CheckoutDtos.CheckoutRequest(
                patient, branch, null, null, courseTemplate, null, null, true, treating, seller, cash,
                null, price, null, null, List.of()),
            adminAuthentication());

    long patientCourse = sale.patientCourseId();
    Map<String, Object> provisional = db.queryForMap(
        "SELECT commission_status,total_course_commission_pool,seller_employee_id,case_owner_employee_id FROM patient_courses WHERE id=?",
        patientCourse);
    assertThat(provisional.get("commission_status")).isEqualTo("PROVISIONAL");
    assertThat(provisional.get("total_course_commission_pool")).isNull();
    assertThat(((Number) provisional.get("seller_employee_id")).longValue()).isEqualTo(seller);
    assertThat(((Number) provisional.get("case_owner_employee_id")).longValue()).isEqualTo(seller);

    // The counter dates the sale today; a month can only be closed once it
    // is over, so the sale is moved back a month before closing it.
    YearMonth lastMonth = YearMonth.now().minusMonths(1);
    db.update("UPDATE patient_courses SET sale_date=?, sale_month=? WHERE id=?",
        lastMonth.atDay(1), lastMonth.atDay(1), patientCourse);
    assertThat(closing.close(lastMonth, seedActorUserId())).isEqualTo(1);
    Map<String, Object> locked = db.queryForMap(
        "SELECT commission_status,locked_commission_rate FROM patient_courses WHERE id=?", patientCourse);
    assertThat(locked.get("commission_status")).isEqualTo("LOCKED");
    assertThat((BigDecimal) locked.get("locked_commission_rate")).isEqualByComparingTo("0.07");
  }

  @Test
  void coursePurchaseIsRejectedAfterSellerMonthIsClosed() {
    long seller = seedStaff("Closed Month Seller");
    long patient = seedPatient("Closed Month Patient");
    long branch = activeBranchId();
    seedFlatScheme("T_CLOSED_MONTH", new BigDecimal("0.07"), null);
    long courseTemplate = db.queryForObject("SELECT id FROM courses LIMIT 1", Long.class);
    BigDecimal price = db.queryForObject("SELECT price FROM courses WHERE id=?", BigDecimal.class, courseTemplate);
    long cash = db.queryForObject("SELECT id FROM payment_methods WHERE code='CASH'", Long.class);
    seedCourse(seller, seller, patient, new BigDecimal("10000"), 10, LocalDate.now());
    YearMonth month = YearMonth.now();
    // The running month cannot be closed through the service; the closing
    // row is written directly to represent a month somebody closed early.
    assertThatThrownBy(() -> closing.close(month, seedActorUserId()))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("ended");
    long schemeId = db.queryForObject(
        "SELECT id FROM commission_schemes WHERE code='T_CLOSED_MONTH'", Long.class);
    db.update(
        "INSERT INTO monthly_commission_closings(closing_month,employee_id,monthly_course_sales,"
            + "scheme_id,commission_scheme_version,calculated_commission_rate,locked_commission_rate,"
            + "status,closed_at) VALUES(?,?,10000,?,1,0.07,0.07,'CLOSED',now())",
        month.atDay(1), seller, schemeId);

    assertThatThrownBy(() -> checkout.checkout(
        new CheckoutDtos.CheckoutRequest(
            patient, branch, null, null, courseTemplate, null, null, false, seller, seller, cash,
            null, price, null, null, List.of()),
        adminAuthentication()))
        .hasRootCauseInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("closed");
    assertThat(db.queryForObject(
        "SELECT count(*) FROM patient_courses WHERE seller_employee_id=? AND sale_month=?",
        Long.class, seller, month.atDay(1))).isEqualTo(1);
  }

  // ---- Transfer integration: transferred balance remains spendable ----------
  @Test
  void transferredCourseCanBeUsedByRecipientWithoutANewSale() {
    long owner = seedStaff("Transfer Owner");
    long sourcePatient = seedPatient("Transfer Source");
    long recipient = seedPatient("Transfer Recipient");
    long course = seedCourse(owner, owner, sourcePatient, new BigDecimal("10000"), 10, LocalDate.of(2026, 8, 1));
    closing.close(YearMonth.of(2026, 8), null);
    Map<String, Object> original = db.queryForMap(
        "SELECT commission_scheme_id,locked_commission_rate,total_course_commission_pool,sales_transaction_id "
            + "FROM patient_courses WHERE id=?", course);
    long salesBefore = db.queryForObject("SELECT count(*) FROM sales_transactions", Long.class);
    long poolsBefore = db.queryForObject("SELECT count(*) FROM commission_allocations", Long.class);

    Authentication authentication = adminAuthentication();
    SecurityContextHolder.getContext().setAuthentication(authentication);
    try {
      transfers.transfer(
          new CourseTransferController.TransferRequest(course, recipient, 4, "family transfer"),
          authentication);
    } finally {
      SecurityContextHolder.clearContext();
    }

    assertThat(db.queryForObject(
        "SELECT allocated_visits FROM course_member_balances WHERE patient_course_id=? AND patient_id=?",
        Integer.class, course, sourcePatient)).isEqualTo(6);
    assertThat(db.queryForObject(
        "SELECT count(*) FROM patient_courses WHERE patient_id=?", Long.class, recipient)).isZero();
    assertThat(db.queryForObject(
        "SELECT allocated_visits FROM course_member_balances WHERE patient_course_id=? AND patient_id=?",
        Integer.class, course, recipient)).isEqualTo(4);
    Map<String, Object> transferred = db.queryForMap(
        "SELECT commission_scheme_id,locked_commission_rate,total_course_commission_pool,sales_transaction_id "
            + "FROM patient_courses WHERE id=?", course);
    assertThat(transferred).containsAllEntriesOf(original);
    assertThat(db.queryForObject("SELECT count(*) FROM sales_transactions", Long.class)).isEqualTo(salesBefore);
    assertThat(db.queryForObject("SELECT count(*) FROM commission_allocations", Long.class)).isEqualTo(poolsBefore);

    assertThatCode(() -> courseUsage.recordCheckoutUsage(
        course, recipient, 1, 1L, null, owner, "Transfer Owner", null, LocalDate.of(2026, 9, 12)))
        .doesNotThrowAnyException();
  }

  @Test
  void releasedCourseCommissionAppearsInTheCommissionLedger() {
    long owner = seedStaff("Ledger Owner");
    long patient = seedPatient("Ledger Patient");
    seedFlatScheme("T_LEDGER", new BigDecimal("0.07"), null);
    long course = seedCourse(owner, owner, patient, new BigDecimal("10000"), 10, LocalDate.of(2026, 8, 1));
    closing.close(YearMonth.of(2026, 8), null);
    use(course, patient, 1, LocalDate.of(2026, 8, 5), owner);

    List<Map<String, Object>> rows = commissionQueries.ledgerRecords(
        LocalDate.of(2026, 8, 1), LocalDate.of(2026, 8, 31), null, owner, adminAuthentication());
    assertThat(rows).hasSize(1);
    assertThat(rows.get(0).get("commission_type")).isEqualTo("COURSE_OWNER");
    assertThat((BigDecimal) rows.get(0).get("commission_amount")).isEqualByComparingTo("70.00");
  }

  // ---- Case 7/8: whole-baht tier table saves; overlap and real gaps do not ----
  @Test
  void wholeBahtTierRangesSaveAndResolveWithoutASilentZeroRate() {
    SecurityContextHolder.getContext().setAuthentication(adminAuthentication());
    try {
      String code = "T_WHOLE_BAHT_" + nextId();
      // The requirement's default table, entered exactly as it is written.
      settings.create(new CommissionSettingsService.Scheme(code, LocalDate.of(2020, 1, 1), null, List.of(
          new CommissionSettingsService.Tier(1, new BigDecimal("0"), new BigDecimal("59999"), new BigDecimal("0.05")),
          new CommissionSettingsService.Tier(2, new BigDecimal("60000"), new BigDecimal("69999"), new BigDecimal("0.06")),
          new CommissionSettingsService.Tier(3, new BigDecimal("70000"), null, new BigDecimal("0.07")))),
          adminAuthentication());

      assertThatThrownBy(() -> settings.create(new CommissionSettingsService.Scheme(code + "_OVERLAP", LocalDate.of(2020, 1, 1), null, List.of(
          new CommissionSettingsService.Tier(1, new BigDecimal("0"), new BigDecimal("59999"), new BigDecimal("0.05")),
          new CommissionSettingsService.Tier(2, new BigDecimal("50000"), null, new BigDecimal("0.07")))),
          adminAuthentication()))
          .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("overlap");
      assertThatThrownBy(() -> settings.create(new CommissionSettingsService.Scheme(code + "_GAP", LocalDate.of(2020, 1, 1), null, List.of(
          new CommissionSettingsService.Tier(1, new BigDecimal("0"), new BigDecimal("59999"), new BigDecimal("0.05")),
          new CommissionSettingsService.Tier(2, new BigDecimal("70000"), null, new BigDecimal("0.07")))),
          adminAuthentication()))
          .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("gap");

      // Make the whole-baht scheme the one the close resolves (highest version wins).
      db.update("UPDATE commission_schemes SET version=99 WHERE code=?", code);
      long seller = seedStaff("Whole Baht Seller");
      long patient = seedPatient("Whole Baht Patient");
      // 59,999.50 falls in the sub-baht sliver between two tiers: still 5%, never 0%.
      seedCourse(seller, seller, patient, new BigDecimal("59999.50"), 10, LocalDate.of(2026, 7, 1));
      closing.close(YearMonth.of(2026, 7), null);
      assertThat(db.queryForObject(
          "SELECT locked_commission_rate FROM monthly_commission_closings WHERE employee_id=? AND closing_month=?",
          BigDecimal.class, seller, LocalDate.of(2026, 7, 1))).isEqualByComparingTo("0.05");
    } finally {
      SecurityContextHolder.clearContext();
    }
  }

  @Test
  void closingRefusesAMonthNoTierCovers() {
    String code = "T_NO_TIER_" + nextId();
    long schemeId = db.queryForObject(
        "INSERT INTO commission_schemes(code,version,effective_from) VALUES(?,99,'2020-01-01') RETURNING id",
        Long.class, code);
    // A tier table that only starts at 100,000: a seller below it has no rate.
    db.update("INSERT INTO commission_tiers(scheme_id,tier_order,minimum_monthly_sales,maximum_monthly_sales,commission_rate)"
        + " VALUES(?,1,100000,NULL,0.10)", schemeId);
    long seller = seedStaff("Uncovered Seller");
    long patient = seedPatient("Uncovered Patient");
    seedCourse(seller, seller, patient, new BigDecimal("10000"), 10, LocalDate.of(2026, 6, 1));
    assertThat(closing.preview(YearMonth.of(2026, 6)).stream()
        .filter(row -> row.employeeId() == seller).findFirst().orElseThrow().suggestedRate()).isNull();
    assertThatThrownBy(() -> closing.close(YearMonth.of(2026, 6), null))
        .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("No commission tier");
    assertThat(db.queryForObject(
        "SELECT commission_status FROM patient_courses WHERE seller_employee_id=?", String.class, seller))
        .isEqualTo("PROVISIONAL");
  }

  // ---- Void of a sold course after its month closed: pool written down, audited, unusable ----
  @Test
  void voidingASoldCourseAfterCloseWritesDownThePoolAndBlocksFurtherUse() {
    long seller = seedStaff("Void After Close Seller");
    long patient = seedPatient("Void After Close Patient");
    long branch = activeBranchId();
    seedFlatScheme("T_VOID_AFTER_CLOSE", new BigDecimal("0.07"), null);
    long courseTemplate = db.queryForObject("SELECT id FROM courses LIMIT 1", Long.class);
    BigDecimal price = db.queryForObject("SELECT price FROM courses WHERE id=?", BigDecimal.class, courseTemplate);
    long cash = db.queryForObject("SELECT id FROM payment_methods WHERE code='CASH'", Long.class);

    CheckoutDtos.TransactionView sale = checkout.checkout(
        new CheckoutDtos.CheckoutRequest(
            patient, branch, null, null, courseTemplate, null, null, false, seller, seller, cash,
            null, price, null, null, List.of()),
        adminAuthentication());
    long course = sale.patientCourseId();
    YearMonth lastMonth = YearMonth.now().minusMonths(1);
    db.update("UPDATE patient_courses SET sale_date=?, sale_month=? WHERE id=?",
        lastMonth.atDay(1), lastMonth.atDay(1), course);
    closing.close(lastMonth, seedActorUserId());
    BigDecimal pool = db.queryForObject(
        "SELECT total_course_commission_pool FROM patient_courses WHERE id=?", BigDecimal.class, course);
    assertThat(pool).isPositive();

    checkout.voidTransaction(sale.id(), "Customer changed their mind", adminAuthentication());

    Map<String, Object> after = db.queryForMap(
        "SELECT status,commission_status,total_course_commission_pool FROM patient_courses WHERE id=?", course);
    assertThat(after.get("status")).isEqualTo("REFUNDED");
    assertThat(after.get("commission_status")).isEqualTo("CANCELLED");
    assertThat((BigDecimal) after.get("total_course_commission_pool")).isEqualByComparingTo("0");
    assertThat(db.queryForObject(
        "SELECT gross_amount FROM commission_adjustments WHERE patient_course_id=? AND adjustment_type='REFUND_POOL_REDUCTION'",
        BigDecimal.class, course)).isEqualByComparingTo(pool.negate());
    assertThat(db.queryForObject(
        "SELECT count(*) FROM audit_logs WHERE entity_type='patient_courses' AND entity_id=? AND action='COURSE_SALE_VOIDED_AFTER_CLOSE'",
        Long.class, String.valueOf(course))).isEqualTo(1);
    // The owner's spendable balance follows the sessions taken back, and the
    // course itself refuses further use.
    assertThat(db.queryForObject(
        "SELECT allocated_visits FROM course_member_balances WHERE patient_course_id=? AND patient_id=?",
        Integer.class, course, patient)).isZero();
    assertThatThrownBy(() -> use(course, patient, 1, LocalDate.now(), seller))
        .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("refunded");
  }

  @Test
  void usageIsRefusedOnAnExpiredCourse() {
    long seller = seedStaff("Expired Seller");
    long patient = seedPatient("Expired Patient");
    long course = seedCourse(seller, seller, patient, new BigDecimal("10000"), 10, LocalDate.of(2026, 1, 1));
    db.update("UPDATE patient_courses SET valid_until='2026-06-30' WHERE id=?", course);
    assertThatThrownBy(() -> use(course, patient, 1, LocalDate.of(2026, 7, 1), seller))
        .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("expired");
    assertThatCode(() -> use(course, patient, 1, LocalDate.of(2026, 6, 30), seller)).doesNotThrowAnyException();
  }

  // ---- A reversed allocation counts once, as a signed adjustment, never twice ----
  @Test
  void voidedAllocationIsNotDoubleCountedInTheCourseCommissionReport() {
    long owner = seedStaff("Report Void Owner");
    long patient = seedPatient("Report Void Patient");
    seedFlatScheme("T_REPORT_VOID", new BigDecimal("0.07"), null);
    long course = seedCourse(owner, owner, patient, new BigDecimal("10000"), 10, LocalDate.of(2026, 5, 1));
    closing.close(YearMonth.of(2026, 5), null);
    long usageId = use(course, patient, 1, LocalDate.of(2026, 5, 10), owner);
    long ledgerEntryId = db.queryForObject(
        "SELECT course_ledger_entry_id FROM course_usages WHERE id=?", Long.class, usageId);
    adjustments.reverseUsageForLedgerEntry(ledgerEntryId, seedActorUserId(), "keyed twice");

    // The visit month keeps what was released then; the clawback is booked
    // in the month the reversal happened. Across both they net to zero —
    // the old query subtracted the reversal twice and showed -70.
    CommissionQueryService.ReportRow visitMonth = commissionQueries.report(
            LocalDate.of(2026, 5, 1), LocalDate.of(2026, 5, 31), owner, adminAuthentication())
        .stream().filter(r -> r.staffId() == owner).findFirst().orElseThrow();
    assertThat(visitMonth.ownerNetReleased()).isEqualByComparingTo("70.00");
    assertThat(visitMonth.adjustments()).isEqualByComparingTo("0");
    assertThat(visitMonth.totalVariablePay()).isEqualByComparingTo("70.00");

    LocalDate today = LocalDate.now();
    CommissionQueryService.ReportRow reversalMonth = commissionQueries.report(
            today.withDayOfMonth(1), today, owner, adminAuthentication())
        .stream().filter(r -> r.staffId() == owner).findFirst().orElseThrow();
    assertThat(reversalMonth.adjustments()).isEqualByComparingTo("-70.00");

    {
      CommissionQueryService.ReportRow whole = commissionQueries.report(
              LocalDate.of(2026, 5, 1), today, owner, adminAuthentication())
          .stream().filter(r -> r.staffId() == owner).findFirst().orElseThrow();
      assertThat(whole.totalVariablePay()).isEqualByComparingTo("0");
    }
  }

  private Authentication adminAuthentication() {
    long actor = seedActorUserId();
    return new UsernamePasswordAuthenticationToken(
        "actor" + actor + "@test.local", "x",
        List.of(new SimpleGrantedAuthority("ROLE_ADMIN")));
  }

  private long activeBranchId() {
    return db.queryForObject(
        "SELECT id FROM branches WHERE active AND deleted_at IS NULL ORDER BY id LIMIT 1",
        Long.class);
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
