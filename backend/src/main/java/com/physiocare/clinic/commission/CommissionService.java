package com.physiocare.clinic.commission;

import java.time.YearMonth;
import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Manual/API course entry — used for a course keyed in outside the checkout
 * counter (an admin backfilling a paper receipt, a test fixture). A course
 * sold at the counter is created by {@code CheckoutService} instead; both
 * paths write the same PROVISIONAL shape and are picked up identically by
 * {@link MonthlyCommissionClosingService}.
 */
@Service
public class CommissionService {
  private final JdbcTemplate db;

  public CommissionService(JdbcTemplate db) {
    this.db = db;
  }

  @Transactional
  public void createCourse(CommissionDtos.CreateCourseRequest r) {
    YearMonth month = YearMonth.from(r.saleDate());
    String owner =
        db.queryForObject(
            "SELECT concat(first_name,' ',last_name) FROM users u JOIN staff s ON"
                + " s.user_id=u.id WHERE s.id=?",
            String.class,
            r.caseOwnerEmployeeId());
    Long branchId =
        db.queryForObject(
            "SELECT branch_id FROM sales_transactions WHERE id=?", Long.class, r.salesTransactionId());
    db.update(
        "INSERT INTO patient_courses(course_id,receipt_no,sales_transaction_id,patient_id,"
            + "package_id,package_name_snapshot,sale_date,sale_month,seller_employee_id,"
            + "case_owner_employee_id,seller_name_snapshot,case_owner_name_snapshot,course_price,"
            + "net_course_sale_amount,total_visits,commissionable_visit_count,branch_id,valid_until)"
            + " SELECT ?,?,?,?,?,name_th,?,?,?,?,?,?,?,?,?,?,?, CASE WHEN validity_days IS NULL THEN"
            + " NULL ELSE ? + validity_days END FROM courses WHERE id=?",
        r.courseId(),
        r.receiptNo(),
        r.salesTransactionId(),
        r.patientId(),
        r.packageId(),
        r.saleDate(),
        month.atDay(1),
        r.sellerEmployeeId(),
        r.caseOwnerEmployeeId(),
        owner,
        owner,
        r.coursePrice(),
        r.coursePrice(),
        r.totalVisits(),
        r.totalVisits(),
        branchId,
        r.saleDate(),
        r.packageId());
    db.update(
        "INSERT INTO shared_course_members(patient_course_id,patient_id,role) SELECT id,?,'OWNER'"
            + " FROM patient_courses WHERE course_id=?",
        r.patientId(),
        r.courseId());
    db.update(
        "INSERT INTO course_member_balances(patient_course_id,patient_id,allocated_visits) SELECT"
            + " id,?,total_visits FROM patient_courses WHERE course_id=?",
        r.patientId(),
        r.courseId());
  }

  public CommissionDtos.CourseView getCourse(long id) {
    List<CommissionDtos.CourseView> rows =
        db.query(
            "SELECT"
                + " course_id,receipt_no,status,total_visits,visits_used,locked_commission_rate,total_course_commission_pool,commission_allocation_per_visit,gross_commission_allocated_total,substitute_treatment_fee_total,owner_net_commission_released_total,COALESCE(total_course_commission_pool,0)-gross_commission_allocated_total"
                + " FROM patient_courses WHERE id=?",
            (rs, n) ->
                new CommissionDtos.CourseView(
                    rs.getString(1),
                    rs.getString(2),
                    rs.getString(3),
                    rs.getInt(4),
                    rs.getInt(5),
                    rs.getInt(4) - rs.getInt(5),
                    rs.getBigDecimal(6),
                    rs.getBigDecimal(7),
                    rs.getBigDecimal(8),
                    rs.getBigDecimal(9),
                    rs.getBigDecimal(10),
                    rs.getBigDecimal(11),
                    rs.getBigDecimal(12)),
            id);
    if (rows.isEmpty()) throw new IllegalArgumentException("Course not found");
    return rows.get(0);
  }
}
