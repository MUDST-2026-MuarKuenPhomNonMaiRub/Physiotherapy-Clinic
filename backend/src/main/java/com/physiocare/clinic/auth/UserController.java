package com.physiocare.clinic.auth;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

/** Account administration for the staff-access screen. */
@RestController
@RequestMapping("/api/v1/users")
@PreAuthorize("hasRole('ADMIN')")
public class UserController {
  private final JdbcTemplate db;
  private final RoleRepository roles;

  public UserController(JdbcTemplate db, RoleRepository roles) {
    this.db = db;
    this.roles = roles;
  }

  public record UpdateRequest(String role, Boolean active) {}

  public record BranchesRequest(@NotBlank String branchIds) {}

  @GetMapping
  public List<Map<String, Object>> list() {
    return db.queryForList(
        "SELECT u.id,u.email,u.first_name,u.last_name,u.active,u.last_login,"
            + " (SELECT r.code FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE"
            + "  ur.user_id=u.id LIMIT 1) AS role_code,"
            + " (SELECT s.id FROM staff s WHERE s.user_id=u.id AND s.deleted_at IS NULL) AS"
            + "  staff_id,"
            + " COALESCE((SELECT string_agg(ub.branch_id::text, ',' ORDER BY ub.branch_id) FROM"
            + "  user_branches ub WHERE ub.user_id=u.id), '') AS branch_ids"
            + " FROM users u WHERE u.deleted_at IS NULL ORDER BY u.id");
  }

  @PatchMapping("/{id}")
  @Transactional
  public Map<String, Object> update(
      @PathVariable long id, @RequestBody UpdateRequest r, Authentication authentication) {
    requireExists(id);
    if (r.active() != null) {
      if (!r.active() && isSelf(id, authentication))
        throw new IllegalArgumentException("You cannot deactivate your own account");
      if (!r.active() && isLastActiveAdmin(id))
        throw new IllegalArgumentException("The clinic must keep at least one active admin");
      db.update("UPDATE users SET active=?,updated_at=now() WHERE id=?", r.active(), id);
    }
    if (r.role() != null && !r.role().isBlank()) {
      String code = "PHYSIOTHERAPIST".equals(r.role().trim()) ? "PHYSIO" : r.role().trim();
      Role role =
          roles.findByCode(code).orElseThrow(() -> new IllegalArgumentException("Unknown role"));
      if (!"ADMIN".equals(code) && isLastActiveAdmin(id))
        throw new IllegalArgumentException("The clinic must keep at least one active admin");
      db.update("DELETE FROM user_roles WHERE user_id=?", id);
      db.update("INSERT INTO user_roles(user_id,role_id) VALUES(?,?)", id, role.getId());
    }
    return get(id);
  }

  /** Branch access for a non-admin account; the ids arrive as a JSON array. */
  @PutMapping("/{id}/branches")
  @Transactional
  public Map<String, Object> setBranches(@PathVariable long id, @RequestBody BranchesRequest r) {
    requireExists(id);
    db.update("DELETE FROM user_branches WHERE user_id=?", id);
    db.update(
        "INSERT INTO user_branches(user_id,branch_id,is_default) SELECT ?, value::bigint,"
            + " row_number() OVER ()=1 FROM jsonb_array_elements_text(?::jsonb) WHERE EXISTS"
            + " (SELECT 1 FROM branches b WHERE b.id=value::bigint AND b.deleted_at IS NULL)",
        id,
        r.branchIds());
    return get(id);
  }

  @DeleteMapping("/{id}")
  @Transactional
  public void softDelete(@PathVariable long id, Authentication authentication) {
    requireExists(id);
    if (isSelf(id, authentication))
      throw new IllegalArgumentException("You cannot remove your own account");
    if (isLastActiveAdmin(id))
      throw new IllegalArgumentException("The clinic must keep at least one active admin");
    db.update("UPDATE users SET active=false,deleted_at=now(),updated_at=now() WHERE id=?", id);
    db.update("UPDATE staff SET deleted_at=now(),status='INACTIVE' WHERE user_id=?", id);
  }

  private Map<String, Object> get(long id) {
    return list().stream()
        .filter(row -> ((Number) row.get("id")).longValue() == id)
        .findFirst()
        .orElseThrow(() -> new IllegalArgumentException("User not found"));
  }

  private void requireExists(long id) {
    Integer count =
        db.queryForObject(
            "SELECT count(*) FROM users WHERE id=? AND deleted_at IS NULL", Integer.class, id);
    if (count == null || count == 0) throw new IllegalArgumentException("User not found");
  }

  private boolean isSelf(long id, Authentication authentication) {
    if (authentication == null) return false;
    Integer count =
        db.queryForObject(
            "SELECT count(*) FROM users WHERE id=? AND lower(email)=lower(?)",
            Integer.class,
            id,
            authentication.getName());
    return count != null && count > 0;
  }

  private boolean isLastActiveAdmin(long id) {
    Integer others =
        db.queryForObject(
            "SELECT count(*) FROM users u JOIN user_roles ur ON ur.user_id=u.id JOIN roles r ON"
                + " r.id=ur.role_id WHERE r.code='ADMIN' AND u.active AND u.deleted_at IS NULL AND"
                + " u.id<>?",
            Integer.class,
            id);
    Integer isAdmin =
        db.queryForObject(
            "SELECT count(*) FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE"
                + " ur.user_id=? AND r.code='ADMIN'",
            Integer.class,
            id);
    return isAdmin != null && isAdmin > 0 && (others == null || others == 0);
  }
}
