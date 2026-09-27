package com.physiocare.clinic.auth;

import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Rules for managing custom roles and the permissions they grant. */
@Service
public class RolePermissionService {
  private final RolePermissionRepository roles;

  public RolePermissionService(RolePermissionRepository roles) {
    this.roles = roles;
  }

  public List<Map<String, Object>> list() {
    return roles.findAllWithPermissions();
  }

  public List<Map<String, Object>> permissions() {
    return roles.findAllPermissions();
  }

  @Transactional
  public Map<String, Object> create(String rawCode, String name, List<String> permissionCodes) {
    String code = rawCode == null ? "" : rawCode.trim().toUpperCase();
    if (!code.matches("[A-Z][A-Z0-9_]{1,29}"))
      throw new IllegalArgumentException(
          "Role code must use 2-30 uppercase letters, numbers or underscores");
    requireName(name);
    validatePermissionCodes(permissionCodes);
    long id = roles.insertRole(code, name.trim());
    roles.replacePermissions(id, permissionCodes);
    return roles.findWithPermissions(id);
  }

  @Transactional
  public Map<String, Object> update(long id, String name, List<String> permissionCodes) {
    String code = roles.findCode(id);
    if ("ADMIN".equals(code) || "PHYSIO".equals(code)) {
      throw new IllegalArgumentException("Built-in roles cannot be modified");
    }
    requireName(name);
    validatePermissionCodes(permissionCodes);
    roles.renameRole(id, name.trim());
    roles.replacePermissions(id, permissionCodes);
    return roles.findWithPermissions(id);
  }

  @Transactional
  public void delete(long id) {
    if (roles.countUsersWithRole(id) > 0)
      throw new IllegalStateException("Cannot delete a role assigned to users");
    roles.deleteCustomRole(id);
  }

  private static void requireName(String name) {
    if (name == null || name.isBlank()) throw new IllegalArgumentException("Role name is required");
  }

  private void validatePermissionCodes(List<String> codes) {
    if (codes == null || codes.isEmpty()) return;
    if (roles.countKnownPermissions(codes) != codes.stream().distinct().count())
      throw new IllegalArgumentException("Unknown permission code");
  }
}
