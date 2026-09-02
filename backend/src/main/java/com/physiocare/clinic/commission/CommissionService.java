package com.physiocare.clinic.commission;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.YearMonth;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class CommissionService {
  private final JdbcTemplate db;

  public CommissionService(JdbcTemplate db) {
    this.db = db;
  }

  private ResponseStatusException bad(String message) {
    return new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, message);
  }

  @Transactional
  public void createCourse(CommissionDtos.CreateCourseRequest r) {
    YearMonth month = YearMonth.from(r.saleDate());
    BigDecimal rate =
        db.query(
            "SELECT COALESCE((SELECT commission_rate FROM commission_tiers t JOIN"
                + " commission_schemes s ON s.id=t.scheme_id WHERE s.active AND s.effective_from<=?"
                + " AND (s.effective_to IS NULL OR s.effective_to>=?) AND t.active AND"
                + " t.minimum_monthly_sales=0 ORDER BY s.version DESC,t.tier_order LIMIT 1),0)",
            ps -> {
              ps.setObject(1, r.saleDate());
              ps.setObject(2, r.saleDate());
            },
            rs -> rs.next() ? rs.getBigDecimal(1) : BigDecimal.ZERO);
    String owner =
        db.queryForObject(
            "SELECT concat(first_name,' ',last_name) FROM users u JOIN staff s ON"
                + " s.user_id=u.id WHERE s.id=?",
            String.class,
            r.caseOwnerEmployeeId());
    db.update(
        "INSERT INTO"
            + " patient_courses(course_id,receipt_no,sales_transaction_id,patient_id,package_id,package_name_snapshot,sale_date,sale_month,seller_employee_id,case_owner_employee_id,seller_name_snapshot,course_price,total_visits,provisional_commission_rate,valid_until)"
            + " SELECT ?,?,?,?,?,name_th,?,?,?, ?,?,?,?, ?, CASE WHEN validity_days IS NULL THEN"
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
        r.coursePrice(),
        r.totalVisits(),
        rate,
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

  @Transactional
  public int closeMonth(YearMonth month) {
    List<Long> employees =
        db.queryForList(
            "SELECT DISTINCT seller_employee_id FROM patient_courses WHERE sale_month=? AND"
                + " commission_status='PROVISIONAL'",
            Long.class,
            month.atDay(1));
    for (Long employee : employees) closeEmployee(month, employee);
    return employees.size();
  }

  private void closeEmployee(YearMonth month, long employee) {
    Map<String, Object> scheme =
        db.queryForMap(
            "SELECT id,version,overflow_policy FROM commission_schemes WHERE active AND"
                + " effective_from<=? AND (effective_to IS NULL OR effective_to>=?) ORDER BY"
                + " version DESC LIMIT 1",
            month.atDay(1),
            month.atEndOfMonth());
    BigDecimal sales =
        db.queryForObject(
            "SELECT COALESCE(sum(course_price),0) FROM patient_courses WHERE sale_month=? AND"
                + " seller_employee_id=? AND status NOT IN ('REFUNDED','CANCELLED')",
            BigDecimal.class,
            month.atDay(1),
            employee);
    Map<String, Object> tier =
        db.queryForMap(
            "SELECT commission_rate FROM commission_tiers WHERE scheme_id=? AND active AND"
                + " minimum_monthly_sales<=? AND (maximum_monthly_sales IS NULL OR"
                + " maximum_monthly_sales>=?) ORDER BY tier_order LIMIT 1",
            scheme.get("id"),
            sales,
            sales);
    BigDecimal rate = (BigDecimal) tier.get("commission_rate");
    int inserted =
        db.update(
            "INSERT INTO"
                + " monthly_commission_closings(closing_month,employee_id,monthly_course_sales,scheme_id,calculated_commission_rate,status,closed_at)"
                + " VALUES(?,?,?,?,?,'CLOSED',now()) ON CONFLICT(closing_month,employee_id) DO"
                + " UPDATE SET"
                + " monthly_course_sales=EXCLUDED.monthly_course_sales,scheme_id=EXCLUDED.scheme_id,calculated_commission_rate=EXCLUDED.calculated_commission_rate,status='CLOSED',closed_at=now()"
                + " WHERE monthly_commission_closings.status='OPEN'",
            month.atDay(1),
            employee,
            sales,
            scheme.get("id"),
            rate);
    if (inserted == 0) throw bad("Commission month is already closed and immutable");
    db.update(
        "UPDATE patient_courses SET"
            + " commission_status='LOCKED',commission_scheme_id=?,commission_scheme_version=?,locked_commission_rate=?,total_course_commission_pool=round(course_price*?"
            + " ,2),commission_allocation_per_visit=round((course_price*?)/total_visits,2) WHERE"
            + " sale_month=? AND seller_employee_id=? AND commission_status='PROVISIONAL'",
        scheme.get("id"),
        scheme.get("version"),
        rate,
        rate,
        rate,
        month.atDay(1),
        employee);
  }

  @Transactional
  public CommissionDtos.CourseView useCourse(long id, CommissionDtos.UseCourseRequest r) {
    Map<String, Object> c =
        db.queryForMap("SELECT * FROM patient_courses WHERE id=? FOR UPDATE", id);
    if (!"ACTIVE".equals(c.get("status"))) throw bad("Course is not active");
    Integer member =
        db.queryForObject(
            "SELECT count(*) FROM course_member_balances WHERE patient_course_id=? AND patient_id=?"
                + " AND used_visits<allocated_visits",
            Integer.class,
            id,
            r.patientId());
    if (member == null || member == 0)
      throw bad("Patient is not an active member or has no course balance");
    Integer visit =
        db.queryForObject(
            "SELECT count(*) FROM visits WHERE id=? AND status='COMPLETED' AND patient_id=?",
            Integer.class,
            r.visitId(),
            r.patientId());
    if (visit == null || visit == 0) throw bad("Visit must exist and be completed");
    if (!"LOCKED".equals(c.get("commission_status")))
      throw bad("Course must be locked by monthly closing before usage");
    int used = ((Number) c.get("visits_used")).intValue();
    int total = ((Number) c.get("total_visits")).intValue();
    if (used >= total) throw bad("Course usage limit exceeded");
    BigDecimal gross = (BigDecimal) c.get("commission_allocation_per_visit");
    BigDecimal fee = BigDecimal.ZERO;
    Long ruleId = r.treatmentFeeRuleId();
    BigDecimal base =
        c.get("course_price") instanceof BigDecimal p
            ? p.divide(BigDecimal.valueOf(total), 8, RoundingMode.HALF_UP)
            : BigDecimal.ZERO;
    String policy = "CAP_AT_COMMISSION";
    if (ruleId != null) {
      Map<String, Object> rule =
          db.queryForMap(
              "SELECT fee_type,fee_value,percentage_base FROM treatment_fee_rules WHERE id=? AND"
                  + " active AND effective_from<=? AND (effective_to IS NULL OR effective_to>=?)",
              ruleId,
              r.visitDate(),
              r.visitDate());
      fee =
          "PERCENTAGE".equals(rule.get("fee_type"))
              ? base.multiply((BigDecimal) rule.get("fee_value"))
                  .divide(BigDecimal.valueOf(100), 8, RoundingMode.HALF_UP)
              : (BigDecimal) rule.get("fee_value");
      policy =
          db.queryForObject(
              "SELECT overflow_policy FROM commission_schemes WHERE id=?",
              String.class,
              c.get("commission_scheme_id"));
    }
    BigDecimal topUp = BigDecimal.ZERO;
    if (fee.compareTo(gross) > 0) {
      if ("BLOCK_AND_REQUIRE_APPROVAL".equals(policy))
        throw bad("Treatment fee exceeds allocation and requires approval");
      if ("CAP_AT_COMMISSION".equals(policy)) fee = gross;
      if ("COMPANY_TOP_UP".equals(policy)) topUp = fee.subtract(gross);
    }
    BigDecimal owner = gross.subtract(fee).max(BigDecimal.ZERO);
    db.update(
        "INSERT INTO"
            + " commission_allocations(visit_id,patient_course_id,patient_id,case_owner_employee_id,treating_employee_id,visit_date,gross_commission_allocation,treatment_fee_rule_id,treatment_fee_amount,owner_net_commission,company_top_up_amount,overflow_policy_used)"
            + " VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
        r.visitId(),
        id,
        r.patientId(),
        c.get("case_owner_employee_id"),
        r.treatingEmployeeId(),
        r.visitDate(),
        gross,
        ruleId,
        fee,
        owner,
        topUp,
        policy);
    db.update(
        "INSERT INTO"
            + " course_ledger_entries(patient_course_id,entry_type,quantity,balance_after,related_visit_id,reason)"
            + " VALUES(?,?,?,?,?,'Course usage')",
        id,
        "USAGE",
        -1,
        total - used - 1,
        r.visitId());
    db.update(
        "UPDATE course_member_balances SET used_visits=used_visits+1,updated_at=now() WHERE"
            + " patient_course_id=? AND patient_id=?",
        id,
        r.patientId());
    db.update(
        "UPDATE patient_courses SET"
            + " visits_used=visits_used+1,gross_commission_allocated_total=gross_commission_allocated_total+?,owner_net_commission_released_total=owner_net_commission_released_total+?,substitute_treatment_fee_total=substitute_treatment_fee_total+?,status=CASE"
            + " WHEN visits_used+1=total_visits THEN 'COMPLETED' ELSE status END WHERE id=?",
        gross,
        owner,
        fee,
        id);
    return getCourse(id);
  }

  public CommissionDtos.CourseView getCourse(long id) {
    return db.queryForObject(
        "SELECT"
            + " course_id,receipt_no,status,total_visits,visits_used,locked_commission_rate,total_course_commission_pool,commission_allocation_per_visit,gross_commission_allocated_total,substitute_treatment_fee_total,owner_net_commission_released_total,COALESCE(total_course_commission_pool,0)-gross_commission_allocated_total"
            + " FROM patient_courses WHERE id=?",
        (rs, n) -> {
          if (!rs.next()) return null;
          return new CommissionDtos.CourseView(
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
              rs.getBigDecimal(12));
        },
        id);
  }

  @Transactional
  public CommissionDtos.CourseView transfer(long id, CommissionDtos.TransferRequest r) {
    Map<String, Object> c =
        db.queryForMap("SELECT * FROM patient_courses WHERE id=? FOR UPDATE", id);
    int remaining =
        ((Number) c.get("total_visits")).intValue() - ((Number) c.get("visits_used")).intValue();
    if (r.quantity() > remaining) throw bad("Transfer quantity exceeds remaining visits");
    long from = ((Number) c.get("patient_id")).longValue();
    String no = "TR-" + System.currentTimeMillis();
    long transfer =
        db.queryForObject(
            "INSERT INTO"
                + " course_transfers(transfer_no,patient_course_id,from_patient_id,to_patient_id,quantity,reason)"
                + " VALUES(?,?,?,?,?,?) RETURNING id",
            Long.class,
            no,
            id,
            from,
            r.toPatientId(),
            r.quantity(),
            r.reason());
    db.update(
        "INSERT INTO shared_course_members(patient_course_id,patient_id,role)"
            + " VALUES(?,?,'SHARED_MEMBER') ON CONFLICT DO NOTHING",
        id,
        r.toPatientId());
    db.update(
        "INSERT INTO course_member_balances(patient_course_id,patient_id,allocated_visits)"
            + " VALUES(?,?,?) ON CONFLICT(patient_course_id,patient_id) DO UPDATE SET"
            + " allocated_visits=course_member_balances.allocated_visits+EXCLUDED.allocated_visits",
        id,
        r.toPatientId(),
        r.quantity());
    db.update(
        "UPDATE course_member_balances SET allocated_visits=allocated_visits-? WHERE"
            + " patient_course_id=? AND patient_id=? AND allocated_visits-used_visits>=?",
        r.quantity(),
        id,
        from,
        r.quantity());
    db.update(
        "INSERT INTO"
            + " course_ledger_entries(patient_course_id,entry_type,quantity,balance_after,related_transfer_id,reason)"
            + " VALUES(?,?,?,?,?,?)",
        id,
        "TRANSFER_OUT",
        -r.quantity(),
        remaining,
        transfer,
        r.reason());
    db.update(
        "INSERT INTO"
            + " course_ledger_entries(patient_course_id,entry_type,quantity,balance_after,related_transfer_id,reason)"
            + " VALUES(?,?,?,?,?,?)",
        id,
        "TRANSFER_IN",
        r.quantity(),
        remaining,
        transfer,
        r.reason());
    return getCourse(id);
  }
}
