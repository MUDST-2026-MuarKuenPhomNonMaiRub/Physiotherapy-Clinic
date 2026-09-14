package com.physiocare.clinic.auth;

import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/roles")
@PreAuthorize("@permissionGuard.hasAny(authentication, 'settings.manage')")
public class RoleController {
  private final JdbcTemplate db;
  public RoleController(JdbcTemplate db) { this.db = db; }

  @GetMapping
  public List<Map<String,Object>> list() {
    List<Map<String,Object>> rows = db.queryForList("SELECT r.id,r.code,r.name,COALESCE(array_agg(p.code) FILTER (WHERE p.code IS NOT NULL),'{}') AS permissions FROM roles r LEFT JOIN role_permissions rp ON rp.role_id=r.id LEFT JOIN permissions p ON p.id=rp.permission_id GROUP BY r.id ORDER BY r.code");
    rows.forEach(RoleController::resolvePermissionsArray);
    return rows;
  }

  @GetMapping("/permissions")
  public List<Map<String,Object>> permissions() { return db.queryForList("SELECT id,code,name FROM permissions ORDER BY code"); }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public Map<String,Object> create(@RequestBody RoleRequest request) {
    String code = request.code().trim().toUpperCase();
    if (!code.matches("[A-Z][A-Z0-9_]{1,29}")) throw new IllegalArgumentException("Role code must use 2-30 uppercase letters, numbers or underscores");
    validatePermissionCodes(request.permissionCodes());
    Long id = db.queryForObject("INSERT INTO roles(code,name) VALUES(?,?) RETURNING id", Long.class, code, request.name().trim());
    if (request.permissionCodes() != null) for (String permission : request.permissionCodes()) db.update("INSERT INTO role_permissions(role_id,permission_id) SELECT ?,id FROM permissions WHERE code=? ON CONFLICT DO NOTHING", id, permission);
    return role(id);
  }

  @PutMapping("/{id}")
  public Map<String,Object> update(@PathVariable Long id, @RequestBody RoleRequest request) {
    if (request.name() == null || request.name().isBlank()) throw new IllegalArgumentException("Role name is required");
    validatePermissionCodes(request.permissionCodes());
    db.update("UPDATE roles SET name=? WHERE id=?", request.name().trim(), id);
    db.update("DELETE FROM role_permissions WHERE role_id=?", id);
    if (request.permissionCodes() != null) for (String permission : request.permissionCodes()) db.update("INSERT INTO role_permissions(role_id,permission_id) SELECT ?,id FROM permissions WHERE code=? ON CONFLICT DO NOTHING", id, permission);
    return role(id);
  }

  private void validatePermissionCodes(List<String> codes) {
    if (codes == null || codes.isEmpty()) return;
    String placeholders = String.join(",", java.util.Collections.nCopies(codes.size(), "?"));
    int known = db.queryForObject("SELECT count(DISTINCT code) FROM permissions WHERE code IN (" + placeholders + ")", Integer.class, codes.toArray());
    if (known != codes.stream().distinct().count()) throw new IllegalArgumentException("Unknown permission code");
  }

  private Map<String,Object> role(long id) {
    Map<String,Object> row = db.queryForMap("SELECT r.id,r.code,r.name,COALESCE(array_agg(p.code) FILTER (WHERE p.code IS NOT NULL),'{}') AS permissions FROM roles r LEFT JOIN role_permissions rp ON rp.role_id=r.id LEFT JOIN permissions p ON p.id=rp.permission_id WHERE r.id=? GROUP BY r.id", id);
    resolvePermissionsArray(row);
    return row;
  }

  /** Postgres returns array_agg() as a java.sql.Array; Jackson can't serialize that JDBC
   * handle directly, so unwrap it to a plain Java array before it leaves the controller. */
  private static void resolvePermissionsArray(Map<String,Object> row) {
    Object permissions = row.get("permissions");
    if (permissions instanceof java.sql.Array array) {
      try {
        row.put("permissions", array.getArray());
      } catch (java.sql.SQLException e) {
        throw new IllegalStateException("Failed to read role permissions", e);
      }
    }
  }

  @DeleteMapping("/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void delete(@PathVariable Long id) {
    Integer users = db.queryForObject("SELECT count(*) FROM user_roles WHERE role_id=?", Integer.class, id);
    if (users != null && users > 0) throw new IllegalStateException("Cannot delete a role assigned to users");
    db.update("DELETE FROM role_permissions WHERE role_id=?", id);
    db.update("DELETE FROM roles WHERE id=? AND code NOT IN ('ADMIN','PHYSIO')", id);
  }
  public record RoleRequest(String code, String name, List<String> permissionCodes) {}
}
