package com.physiocare.clinic.common;

import java.util.List;
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

  public void requirePatientExists(long patientId) {
    Integer count = db.queryForObject(
        "SELECT count(*) FROM patients WHERE id=? AND deleted_at IS NULL", Integer.class, patientId);
    if (count == null || count == 0) throw new IllegalArgumentException("Patient not found");
  }

  public void requireStaffInBranch(Long staffId, long branchId, String label) {
    if (staffId == null) return;
    Integer count = db.queryForObject(
        "SELECT count(*) FROM staff s LEFT JOIN users u ON u.id=s.user_id "
            + "JOIN LATERAL unnest(string_to_array(trim(both '[]' from s.branch_ids), ',')) x(value) ON true "
            + "WHERE s.id=? AND s.deleted_at IS NULL AND s.status='ACTIVE' "
            + "AND (s.user_id IS NULL OR (u.active AND u.deleted_at IS NULL)) "
            + "AND x.value::bigint=?",
        Integer.class, staffId, branchId);
    if (count == null || count == 0) throw new IllegalArgumentException(label + " is not active in this branch");
  }

  /**
   * Patients are clinic-wide records. A patient may register at one branch and
   * later receive care, buy a course, or make a payment at another branch.
   * Access is therefore based on any branch relationship, not only the
   * registered branch.
   */
  public void requirePatientAccess(Authentication authentication, long patientId) {
    if (authentication == null || !authentication.isAuthenticated())
      throw new IllegalArgumentException("Authentication is required");
    boolean admin = authentication.getAuthorities().stream()
        .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
    if (admin) return;
    Integer allowed = db.queryForObject(
        "SELECT count(*) FROM patients p JOIN user_branches ub ON ub.branch_id=p.registered_branch_id"
            + " JOIN users u ON u.id=ub.user_id WHERE p.id=? AND lower(u.email)=lower(?)"
            + " AND u.active AND u.deleted_at IS NULL"
            + " OR EXISTS (SELECT 1 FROM appointments a JOIN user_branches aub ON aub.branch_id=a.branch_id"
            + " JOIN users au ON au.id=aub.user_id WHERE a.patient_id=p.id AND p.id=?"
            + " AND lower(au.email)=lower(?) AND au.active AND au.deleted_at IS NULL)"
            + " OR EXISTS (SELECT 1 FROM sales_transactions st JOIN user_branches sub ON sub.branch_id=st.branch_id"
            + " JOIN users su ON su.id=sub.user_id WHERE st.patient_id=p.id AND p.id=?"
            + " AND lower(su.email)=lower(?) AND su.active AND su.deleted_at IS NULL)"
            + " OR EXISTS (SELECT 1 FROM patient_courses pc JOIN user_branches cub ON cub.branch_id=pc.branch_id"
            + " JOIN users cu ON cu.id=cub.user_id WHERE pc.patient_id=p.id AND p.id=?"
            + " AND lower(cu.email)=lower(?) AND cu.active AND cu.deleted_at IS NULL)",
        Integer.class, patientId, authentication.getName(), patientId, authentication.getName(),
        patientId, authentication.getName(), patientId, authentication.getName());
    if (allowed == null || allowed == 0) throw new IllegalArgumentException("Patient access denied");
  }

  public void requireCourseAccess(Authentication authentication, long courseId) {
    // patient_courses has carried its own branch_id since V8 — a course with
    // no sales_transaction (a transfer target, or one entered outside a
    // checkout receipt) still has a branch, so the old join through
    // sales_transactions denied access to exactly those courses.
    List<Long> rows =
        db.queryForList("SELECT branch_id FROM patient_courses WHERE id=?", Long.class, courseId);
    if (rows.isEmpty() || rows.get(0) == null)
      throw new IllegalArgumentException("Course not found or has no branch on record");
    requireAccess(authentication, rows.get(0));
  }

  /** Call only after {@link #requireCourseAccess} has already confirmed the caller may see this course. */
  public long branchIdOf(long courseId) {
    return db.queryForObject("SELECT branch_id FROM patient_courses WHERE id=?", Long.class, courseId);
  }
}
