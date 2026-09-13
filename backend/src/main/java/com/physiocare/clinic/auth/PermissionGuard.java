package com.physiocare.clinic.auth;

import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;

/** Method-security bridge for database-configured permissions. */
@Component("permissionGuard")
public class PermissionGuard {
  public boolean hasAny(Authentication authentication, String... values) {
    if (authentication == null || !authentication.isAuthenticated()) return false;
    for (String value : values) {
      if (authentication.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals(value) || a.getAuthority().equals("PERM_" + value.toUpperCase().replace('.', '_')))) return true;
      if (authentication.getAuthorities().stream().anyMatch(a -> legacyRoleAllows(a.getAuthority(), value))) return true;
    }
    return false;
  }

  private boolean legacyRoleAllows(String authority, String permission) {
    if ("ROLE_ADMIN".equals(authority)) return true;
    if ("ROLE_PHYSIO".equals(authority) || "ROLE_RECEPTIONIST".equals(authority))
      return permission.startsWith("patient.") || permission.startsWith("appointment.") || permission.startsWith("course.") || permission.equals("checkout.create") || permission.equals("transaction.view") || permission.equals("report.view") || permission.equals("commission.view.own");
    if ("ROLE_FINANCE".equals(authority)) return permission.startsWith("transaction.") || permission.startsWith("report.") || permission.startsWith("commission.") || permission.equals("checkout.create");
    if ("ROLE_REPORT_VIEWER".equals(authority)) return permission.startsWith("report.") || permission.startsWith("commission.");
    return false;
  }
}
