package com.physiocare.clinic.service;

import com.physiocare.clinic.dto.commission.CommissionReportDtos.ReportRow;

import static org.assertj.core.api.Assertions.assertThat;

import com.physiocare.clinic.dto.checkout.CheckoutDtos;
import com.physiocare.clinic.dto.checkout.CourseTransferDtos.TransferRequest;
import com.physiocare.clinic.controller.CourseTransferController;
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

/** Acceptance tests for the clinic meeting rules that supersede the PDF. */
class LatestCommissionRequirementsTest extends AbstractCommissionIntegrationTest {
  @Autowired private CheckoutService checkout;
  @Autowired private MonthlyCommissionClosingService closing;
  @Autowired private CourseUsageService courseUsage;
  @Autowired private CourseTransferController transfers;
  @Autowired private CommissionQueryService queries;
  @Autowired private CommissionAdjustmentService adjustments;

  @Test
  void oneSaleCreditsTwoOwnersAtFullPriceAndUsesPaidPlusBonusVisits() {
    long ownerA = seedStaff("Split Owner A");
    long ownerB = seedStaff("Split Owner B");
    long patient = seedPatient("Split Course Patient");
    long branch = activeBranchId();
    seedFlatScheme("LATEST_SPLIT", new BigDecimal("0.10"), "COMPANY_TOP_UP");
    long template = standardTemplate(new BigDecimal("10000"), 10, 1);
    long cash = cashPaymentMethod();

    CheckoutDtos.TransactionView sale = checkout.checkout(
        new CheckoutDtos.CheckoutRequest(
            patient, branch, null, null, template, null, null, false, ownerA, ownerA, cash,
            null, new BigDecimal("9000"), null, new BigDecimal("10000"),
            List.of(new CheckoutDtos.Adjustment("Clinic discount", new BigDecimal("-1000"))),
            ownerA,
            List.of(
                new CheckoutDtos.CourseCommissionSplit(ownerA, new BigDecimal("5000"), 6),
                new CheckoutDtos.CourseCommissionSplit(ownerB, new BigDecimal("5000"), 5))),
        adminAuthentication());

    long patientCourse = sale.patientCourseId();
    Map<String, Object> course = db.queryForMap(
        "SELECT course_price,net_course_sale_amount,clinic_discount_amount,"
            + "commissionable_visit_count,overflow_policy_snapshot FROM patient_courses WHERE id=?",
        patientCourse);
    assertThat((BigDecimal) course.get("course_price")).isEqualByComparingTo("10000");
    assertThat((BigDecimal) course.get("net_course_sale_amount")).isEqualByComparingTo("9000");
    assertThat((BigDecimal) course.get("clinic_discount_amount")).isEqualByComparingTo("1000");
    assertThat(((Number) course.get("commissionable_visit_count")).intValue()).isEqualTo(11);
    assertThat(course.get("overflow_policy_snapshot")).isEqualTo("COMPANY_TOP_UP");

    YearMonth saleMonth = YearMonth.now().minusMonths(1);
    db.update("UPDATE patient_courses SET sale_date=?,sale_month=? WHERE id=?",
        saleMonth.atDay(1), saleMonth.atDay(1), patientCourse);
    assertThat(closing.close(saleMonth, seedActorUserId())).isEqualTo(2);

    List<Map<String, Object>> splits = db.queryForList(
        "SELECT * FROM course_commission_splits WHERE patient_course_id=? ORDER BY split_order",
        patientCourse);
    assertThat(splits).hasSize(2);
    assertThat((BigDecimal) splits.get(0).get("total_commission_pool")).isEqualByComparingTo("500");
    assertThat((BigDecimal) splits.get(0).get("commission_allocation_per_visit")).isEqualByComparingTo("83.33");
    assertThat((BigDecimal) splits.get(1).get("total_commission_pool")).isEqualByComparingTo("500");
    assertThat((BigDecimal) splits.get(1).get("commission_allocation_per_visit")).isEqualByComparingTo("100");
    assertThat(db.queryForObject(
        "SELECT monthly_course_sales FROM monthly_commission_closings WHERE closing_month=?"
            + " AND employee_id=?",
        BigDecimal.class, saleMonth.atDay(1), ownerA)).isEqualByComparingTo("5000");
    assertThat(db.queryForObject(
        "SELECT monthly_course_sales FROM monthly_commission_closings WHERE closing_month=?"
            + " AND employee_id=?",
        BigDecimal.class, saleMonth.atDay(1), ownerB)).isEqualByComparingTo("5000");

    long usage = courseUsage.recordCheckoutUsage(
        patientCourse, patient, 1, branch, null, ownerB, "Owner B", null, LocalDate.now());
    Map<String, Object> allocation = db.queryForMap(
        "SELECT * FROM commission_allocations WHERE course_usage_id=?", usage);
    assertThat(((Number) allocation.get("case_owner_employee_id")).longValue()).isEqualTo(ownerB);
    assertThat((BigDecimal) allocation.get("gross_commission_allocation")).isEqualByComparingTo("100");
    assertThat((BigDecimal) allocation.get("treatment_fee_amount")).isEqualByComparingTo("0");

    List<Map<String, Object>> ownerBDetail = queries.staffDetail(
        ownerB, saleMonth.atDay(1), LocalDate.now(), adminAuthentication());
    assertThat(ownerBDetail).hasSize(1);
    assertThat((BigDecimal) ownerBDetail.get(0).get("total_course_commission_pool"))
        .isEqualByComparingTo("500");
    assertThat(((Number) ownerBDetail.get(0).get("case_owner_employee_id")).longValue())
        .isEqualTo(ownerB);
  }

  @Test
  void bonusVisitsDiluteASingleOwnersPoolAndDiscountDoesNotDiluteTier() {
    long owner = seedStaff("Bonus Owner");
    long patient = seedPatient("Bonus Patient");
    long branch = activeBranchId();
    seedFlatScheme("LATEST_BONUS", new BigDecimal("0.10"), "COMPANY_TOP_UP");
    long template = standardTemplate(new BigDecimal("10000"), 10, 1);

    CheckoutDtos.TransactionView sale = checkout.checkout(
        new CheckoutDtos.CheckoutRequest(
            patient, branch, null, null, template, null, null, false, owner, owner,
            cashPaymentMethod(), null, new BigDecimal("8000"), null, new BigDecimal("10000"),
            List.of(new CheckoutDtos.Adjustment("Clinic discount", new BigDecimal("-2000"))),
            owner, null),
        adminAuthentication());
    YearMonth month = YearMonth.now().minusMonths(1);
    db.update("UPDATE patient_courses SET sale_date=?,sale_month=? WHERE id=?",
        month.atDay(1), month.atDay(1), sale.patientCourseId());
    closing.close(month, seedActorUserId());

    Map<String, Object> split = db.queryForMap(
        "SELECT * FROM course_commission_splits WHERE patient_course_id=?", sale.patientCourseId());
    assertThat((BigDecimal) split.get("sales_credit_amount")).isEqualByComparingTo("10000");
    assertThat(((Number) split.get("allocated_visits")).intValue()).isEqualTo(11);
    assertThat((BigDecimal) split.get("total_commission_pool")).isEqualByComparingTo("1000");
    assertThat((BigDecimal) split.get("commission_allocation_per_visit")).isEqualByComparingTo("90.90");
  }

  @Test
  void specialCoursePaysImmediatelyAndNeverCreatesAVisitPool() {
    long owner = seedStaff("Special Owner");
    long patient = seedPatient("Special Patient");
    long branch = activeBranchId();
    long template = standardTemplate(new BigDecimal("12000"), 10, 0);
    db.update(
        "UPDATE courses SET commission_mode='SPECIAL_IMMEDIATE',special_commission_type='PERCENTAGE',"
            + "special_commission_value=12 WHERE id=?",
        template);

    CheckoutDtos.TransactionView sale = checkout.checkout(
        new CheckoutDtos.CheckoutRequest(
            patient, branch, null, null, template, null, null, false, owner, owner,
            cashPaymentMethod(), null, new BigDecimal("12000"), null, new BigDecimal("12000"),
            List.of(), owner, null),
        adminAuthentication());

    Map<String, Object> course = db.queryForMap(
        "SELECT commission_status,total_course_commission_pool,special_commission_total"
            + " FROM patient_courses WHERE id=?",
        sale.patientCourseId());
    assertThat(course.get("commission_status")).isEqualTo("PAID_IMMEDIATE");
    assertThat((BigDecimal) course.get("total_course_commission_pool")).isEqualByComparingTo("0");
    assertThat((BigDecimal) course.get("special_commission_total")).isEqualByComparingTo("1440");
    assertThat(db.queryForObject(
        "SELECT amount FROM transaction_commissions WHERE sales_transaction_id=? AND"
            + " rule_name_snapshot LIKE 'Special immediate%'",
        BigDecimal.class, sale.id())).isEqualByComparingTo("1440");
    ReportRow report = queries.report(
        LocalDate.now().withDayOfMonth(1), LocalDate.now(), owner, adminAuthentication())
        .stream().findFirst().orElseThrow();
    assertThat(report.specialImmediateCommission()).isEqualByComparingTo("1440");
    assertThat(report.totalVariablePay()).isEqualByComparingTo("1440");

    long usage = courseUsage.recordCheckoutUsage(
        sale.patientCourseId(), patient, 1, branch, null, owner, "Special Owner", null,
        LocalDate.now());
    assertThat(db.queryForObject("SELECT status FROM course_usages WHERE id=?", String.class, usage))
        .isEqualTo("LEGACY_UNALLOCATED");
    assertThat(db.queryForObject(
        "SELECT count(*) FROM commission_allocations WHERE course_usage_id=?", Long.class, usage))
        .isZero();
  }

  @Test
  void transferredCourseUsesSubstituteFeeWithCompanyTopUpAndKeepsAuditLineage() {
    long owner = seedStaff("Transfer Commission Owner");
    long substitute = seedStaff("Transfer Substitute");
    long sourcePatient = seedPatient("Transfer Source Latest");
    long receiver = seedPatient("Transfer Receiver Latest");
    long branch = activeBranchId();
    seedFlatScheme("LATEST_TRANSFER", new BigDecimal("0.04"), "CAP_AT_COMMISSION");
    long template = standardTemplate(new BigDecimal("10000"), 10, 0);
    CheckoutDtos.TransactionView sale = checkout.checkout(
        new CheckoutDtos.CheckoutRequest(
            sourcePatient, branch, null, null, template, null, null, false, owner, owner,
            cashPaymentMethod(), null, new BigDecimal("10000"), null, new BigDecimal("10000"),
            List.of(), owner, null),
        adminAuthentication());
    YearMonth month = YearMonth.now().minusMonths(1);
    db.update("UPDATE patient_courses SET sale_date=?,sale_month=? WHERE id=?",
        month.atDay(1), month.atDay(1), sale.patientCourseId());
    closing.close(month, seedActorUserId());
    db.update(
        "INSERT INTO treatment_fee_rules(version,employee_id,fee_type,fee_value,effective_from,active)"
            + " VALUES(1,?,'FIXED',60,'2020-01-01',true)",
        substitute);

    Authentication authentication = adminAuthentication();
    SecurityContextHolder.getContext().setAuthentication(authentication);
    try {
      transfers.transfer(
          new TransferRequest(
              sale.patientCourseId(), receiver, 1, "clinic-approved transfer"),
          authentication);
    } finally {
      SecurityContextHolder.clearContext();
    }

    long secondBranch = db.queryForObject(
        "INSERT INTO branches(code,name) VALUES(?,?) RETURNING id",
        Long.class, "IT" + (nextId() % 10000), "Integration branch");
    long usage = courseUsage.recordCheckoutUsage(
        sale.patientCourseId(), receiver, 1, secondBranch, null, substitute,
        "Transfer Substitute", null, LocalDate.now());
    Map<String, Object> allocation = db.queryForMap(
        "SELECT * FROM commission_allocations WHERE course_usage_id=?", usage);
    assertThat(((Number) allocation.get("case_owner_employee_id")).longValue()).isEqualTo(owner);
    assertThat((BigDecimal) allocation.get("gross_commission_allocation")).isEqualByComparingTo("40");
    assertThat((BigDecimal) allocation.get("treatment_fee_amount")).isEqualByComparingTo("60");
    assertThat((BigDecimal) allocation.get("company_top_up_amount")).isEqualByComparingTo("20");
    assertThat((BigDecimal) allocation.get("owner_net_commission")).isEqualByComparingTo("0");
    assertThat(db.queryForObject(
        "SELECT count(*) FROM audit_logs WHERE action='COURSE_TRANSFERRED' AND"
            + " after_data->>'fromPatientId'=? AND after_data->>'toPatientId'=?",
        Long.class, String.valueOf(sourcePatient), String.valueOf(receiver))).isEqualTo(1);

    long directUsage = courseUsage.recordCheckoutUsage(
        sale.patientCourseId(), sourcePatient, 1, secondBranch, null, owner,
        "Owner at another branch", null, LocalDate.now());
    Map<String, Object> direct = db.queryForMap(
        "SELECT treatment_fee_amount,owner_net_commission FROM commission_allocations"
            + " WHERE course_usage_id=?",
        directUsage);
    assertThat((BigDecimal) direct.get("treatment_fee_amount")).isEqualByComparingTo("0");
    assertThat((BigDecimal) direct.get("owner_net_commission")).isEqualByComparingTo("40");
  }

  @Test
  void splitCourseRefundReducesOnlyOutstandingBucketsAndRetiresThoseVisits() {
    long ownerA = seedStaff("Refund Split Owner A");
    long ownerB = seedStaff("Refund Split Owner B");
    long patient = seedPatient("Refund Split Patient");
    long branch = activeBranchId();
    seedFlatScheme("LATEST_SPLIT_REFUND", new BigDecimal("0.10"), "COMPANY_TOP_UP");
    long template = standardTemplate(new BigDecimal("10000"), 10, 0);
    CheckoutDtos.TransactionView sale = checkout.checkout(
        new CheckoutDtos.CheckoutRequest(
            patient, branch, null, null, template, null, null, false, ownerA, ownerA,
            cashPaymentMethod(), null, new BigDecimal("10000"), null, new BigDecimal("10000"),
            List.of(), ownerA,
            List.of(
                new CheckoutDtos.CourseCommissionSplit(ownerA, new BigDecimal("5000"), 5),
                new CheckoutDtos.CourseCommissionSplit(ownerB, new BigDecimal("5000"), 5))),
        adminAuthentication());
    YearMonth month = YearMonth.now().minusMonths(1);
    db.update("UPDATE patient_courses SET sale_date=?,sale_month=? WHERE id=?",
        month.atDay(1), month.atDay(1), sale.patientCourseId());
    closing.close(month, seedActorUserId());

    adjustments.refundRemainingVisits(
        sale.patientCourseId(), 5, branch, seedActorUserId(), "Finance", "patient refund");

    List<Map<String, Object>> splits = db.queryForList(
        "SELECT split_order,total_commission_pool,refunded_visits FROM course_commission_splits"
            + " WHERE patient_course_id=? ORDER BY split_order",
        sale.patientCourseId());
    assertThat((BigDecimal) splits.get(0).get("total_commission_pool")).isEqualByComparingTo("500");
    assertThat(((Number) splits.get(0).get("refunded_visits")).intValue()).isZero();
    assertThat((BigDecimal) splits.get(1).get("total_commission_pool")).isEqualByComparingTo("0");
    assertThat(((Number) splits.get(1).get("refunded_visits")).intValue()).isEqualTo(5);
    assertThat(db.queryForObject(
        "SELECT total_course_commission_pool FROM patient_courses WHERE id=?",
        BigDecimal.class, sale.patientCourseId())).isEqualByComparingTo("500");
  }

  private long standardTemplate(BigDecimal price, int sessions, int bonus) {
    long id = db.queryForObject("SELECT id FROM courses ORDER BY id LIMIT 1", Long.class);
    db.update(
        "UPDATE courses SET price=?,total_sessions=?,bonus_sessions=?,commission_mode='STANDARD_TIERED',"
            + "special_commission_type=NULL,special_commission_value=NULL WHERE id=?",
        price, sessions, bonus, id);
    return id;
  }

  private long cashPaymentMethod() {
    return db.queryForObject("SELECT id FROM payment_methods WHERE code='CASH'", Long.class);
  }

  private long activeBranchId() {
    return db.queryForObject(
        "SELECT id FROM branches WHERE active AND deleted_at IS NULL ORDER BY id LIMIT 1",
        Long.class);
  }

  private Authentication adminAuthentication() {
    long actor = seedActorUserId();
    return new UsernamePasswordAuthenticationToken(
        "actor" + actor + "@test.local", "x",
        List.of(new SimpleGrantedAuthority("ROLE_ADMIN")));
  }
}
