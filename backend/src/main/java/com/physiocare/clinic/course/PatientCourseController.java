package com.physiocare.clinic.course;

import com.physiocare.clinic.common.BranchAccessService;
import java.time.LocalDate;
import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/patient-courses")
public class PatientCourseController {
  private final JdbcTemplate db;
  private final BranchAccessService branches;

  public PatientCourseController(JdbcTemplate db, BranchAccessService branches) {
    this.db = db;
    this.branches = branches;
  }

  public record PatientCourseView(
      long id,
      long patientId,
      long packageId,
      String purchaseDate,
      String expiryDate,
      int purchased,
      int bonus,
      int used,
      long branchId,
      String status) {}

  @GetMapping
  public List<PatientCourseView> list(
      @RequestParam(required = false) Long branchId, Authentication authentication) {
    branches.requireFilter(authentication, branchId);
    return db.query(
        "SELECT pc.id,pc.patient_id,pc.package_id,pc.sale_date,pc.valid_until,pc.total_visits,"
            + " pc.visits_used,st.branch_id,pc.status FROM patient_courses pc"
            + " JOIN sales_transactions st ON st.id=pc.sales_transaction_id"
            + " WHERE (CAST(? AS BIGINT) IS NULL OR st.branch_id=?) ORDER BY pc.sale_date DESC,pc.id DESC",
        (rs, row) ->
            new PatientCourseView(
                rs.getLong("id"),
                rs.getLong("patient_id"),
                rs.getLong("package_id"),
                rs.getObject("sale_date", LocalDate.class).toString(),
                rs.getObject("valid_until", LocalDate.class).toString(),
                rs.getInt("total_visits"),
                0,
                rs.getInt("visits_used"),
                rs.getLong("branch_id"),
                rs.getString("status")),
        branchId,
        branchId);
  }
}
