package com.physiocare.clinic.common;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;

@Service
public class BranchAccessService {
  private final JdbcTemplate db;

  public BranchAccessService(JdbcTemplate db) {
    this.db = db;
  }

  public void requireAccess(Authentication authentication, long branchId) {
    if (authentication == null || !authentication.isAuthenticated())
      throw new IllegalArgumentException("Authentication is required");
    boolean admin =
        authentication.getAuthorities().stream()
            .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
    if (admin) return;
    Integer allowed =
        db.queryForObject(
            "SELECT count(*) FROM user_branches ub JOIN users u ON u.id=ub.user_id WHERE"
                + " lower(u.email)=lower(?) AND u.active AND u.deleted_at IS NULL AND"
                + " ub.branch_id=?",
            Integer.class,
            authentication.getName(),
            branchId);
    if (allowed == null || allowed == 0) throw new IllegalArgumentException("Branch access denied");
  }

  public void requireFilter(Authentication authentication, Long branchId) {
    boolean admin =
        authentication != null
            && authentication.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
    if (!admin && branchId == null) throw new IllegalArgumentException("branchId is required");
    if (branchId != null) requireAccess(authentication, branchId);
  }

  public void requireActiveBranch(long branchId) {
    Integer active =
        db.queryForObject(
            "SELECT count(*) FROM branches WHERE id=? AND active AND deleted_at IS NULL",
            Integer.class,
            branchId);
    if (active == null || active == 0)
      throw new IllegalArgumentException("Invalid or inactive branch");
  }

  public void requireCourseAccess(Authentication authentication, long courseId) {
    Long branchId =
        db.queryForObject(
            "SELECT st.branch_id FROM patient_courses pc JOIN sales_transactions st "
                + "ON st.id=pc.sales_transaction_id WHERE pc.id=?",
            Long.class,
            courseId);
    if (branchId == null) throw new IllegalArgumentException("Course not found");
    requireAccess(authentication, branchId);
  }
}
