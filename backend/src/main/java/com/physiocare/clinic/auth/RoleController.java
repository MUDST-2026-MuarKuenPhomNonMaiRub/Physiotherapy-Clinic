package com.physiocare.clinic.auth;

import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/roles")
@PreAuthorize("hasRole('ADMIN')")
public class RoleController {
  private final JdbcTemplate db;
  public RoleController(JdbcTemplate db) { this.db = db; }

  @GetMapping
  public List<Map<String,Object>> list() {
    return db.queryForList("SELECT r.id,r.code,r.name,COALESCE(array_agg(p.code) FILTER (WHERE p.code IS NOT NULL),'{}') AS permissions FROM roles r LEFT JOIN role_permissions rp ON rp.role_id=r.id LEFT JOIN permissions p ON p.id=rp.permission_id GROUP BY r.id ORDER BY r.code");
  }

  @GetMapping("/permissions")
  public List<Map<String,Object>> permissions() { return db.queryForList("SELECT id,code,name FROM permissions ORDER BY code"); }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public Map<String,Object> create(@RequestBody RoleRequest request) {
    String code = request.code().trim().toUpperCase();
    if (!code.matches("[A-Z][A-Z0-9_]{1,29}")) throw new IllegalArgumentException("Role code must use 2-30 uppercase letters, numbers or underscores");
    Long id = db.queryForObject("INSERT INTO roles(code,name) VALUES(?,?) RETURNING id", Long.class, code, request.name().trim());
    if (request.permissionCodes() != null) for (String permission : request.permissionCodes()) db.update("INSERT INTO role_permissions(role_id,permission_id) SELECT ?,id FROM permissions WHERE code=? ON CONFLICT DO NOTHING", id, permission);
    return db.queryForMap("SELECT id,code,name FROM roles WHERE id=?", id);
  }
  public record RoleRequest(String code, String name, List<String> permissionCodes) {}
}
