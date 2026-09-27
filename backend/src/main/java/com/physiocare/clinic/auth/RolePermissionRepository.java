package com.physiocare.clinic.auth;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Database operations for roles and the permissions attached to them. */
@Repository
public class RolePermissionRepository {
  private static final String ROLE_SELECT =
      "SELECT r.id,r.code,r.name,COALESCE(array_agg(p.code) FILTER (WHERE p.code IS NOT NULL),'{}')"
          + " AS permissions FROM roles r LEFT JOIN role_permissions rp ON rp.role_id=r.id"
          + " LEFT JOIN permissions p ON p.id=rp.permission_id";

  private final JdbcTemplate db;

  public RolePermissionRepository(JdbcTemplate db) {
    this.db = db;
  }

  public List<Map<String, Object>> findAllWithPermissions() {
    List<Map<String, Object>> rows = db.queryForList(ROLE_SELECT + " GROUP BY r.id ORDER BY r.code");
    rows.forEach(RolePermissionRepository::resolvePermissionsArray);
    return rows;
  }

  public Map<String, Object> findWithPermissions(long id) {
    Map<String, Object> row = db.queryForMap(ROLE_SELECT + " WHERE r.id=? GROUP BY r.id", id);
    resolvePermissionsArray(row);
    return row;
  }

  public String findCode(long id) {
    return db.query("SELECT code FROM roles WHERE id=?", rs -> {
      if (!rs.next()) throw new IllegalArgumentException("Role not found");
      return rs.getString("code");
    }, id);
  }

  public List<Map<String, Object>> findAllPermissions() {
    return db.queryForList("SELECT id,code,name FROM permissions ORDER BY code");
  }

  public int countKnownPermissions(List<String> codes) {
    String placeholders = String.join(",", Collections.nCopies(codes.size(), "?"));
    return db.queryForObject(
        "SELECT count(DISTINCT code) FROM permissions WHERE code IN (" + placeholders + ")",
        Integer.class,
        codes.toArray());
  }

  public long insertRole(String code, String name) {
    return db.queryForObject(
        "INSERT INTO roles(code,name) VALUES(?,?) RETURNING id", Long.class, code, name);
  }

  public void renameRole(long id, String name) {
    db.update("UPDATE roles SET name=? WHERE id=?", name, id);
  }

  public void replacePermissions(long roleId, List<String> permissionCodes) {
    db.update("DELETE FROM role_permissions WHERE role_id=?", roleId);
    if (permissionCodes == null) return;
    for (String permission : permissionCodes) {
      db.update(
          "INSERT INTO role_permissions(role_id,permission_id) SELECT ?,id FROM permissions"
              + " WHERE code=? ON CONFLICT DO NOTHING",
          roleId,
          permission);
    }
  }

  public int countUsersWithRole(long roleId) {
    Integer users =
        db.queryForObject("SELECT count(*) FROM user_roles WHERE role_id=?", Integer.class, roleId);
    return users == null ? 0 : users;
  }

  public void deleteCustomRole(long roleId) {
    db.update("DELETE FROM role_permissions WHERE role_id=?", roleId);
    db.update("DELETE FROM roles WHERE id=? AND code NOT IN ('ADMIN','PHYSIO')", roleId);
  }

  /** Postgres returns array_agg() as a java.sql.Array, which Jackson cannot serialize. */
  private static void resolvePermissionsArray(Map<String, Object> row) {
    if (row.get("permissions") instanceof java.sql.Array array) {
      try {
        row.put("permissions", array.getArray());
      } catch (java.sql.SQLException e) {
        throw new IllegalStateException("Failed to read role permissions", e);
      }
    }
  }
}
