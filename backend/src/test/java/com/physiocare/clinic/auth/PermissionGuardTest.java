package com.physiocare.clinic.auth;

import static org.junit.jupiter.api.Assertions.*;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

class PermissionGuardTest {
  private final PermissionGuard guard = new PermissionGuard();

  @Test
  void acceptsDatabaseConfiguredPermission() {
    var auth = new UsernamePasswordAuthenticationToken("custom", "n/a",
        List.of(new SimpleGrantedAuthority("PERM_SETTINGS_MANAGE")));
    assertTrue(guard.hasAny(auth, "settings.manage"));
  }

  @Test
  void deniesMissingPermission() {
    var auth = new UsernamePasswordAuthenticationToken("custom", "n/a",
        List.of(new SimpleGrantedAuthority("PERM_PATIENT_VIEW")));
    assertFalse(guard.hasAny(auth, "settings.manage"));
  }

  @Test
  void preservesBuiltInAdminCompatibility() {
    var auth = new UsernamePasswordAuthenticationToken("admin", "n/a",
        List.of(new SimpleGrantedAuthority("ROLE_ADMIN")));
    assertTrue(guard.hasAny(auth, "settings.manage"));
  }

  @Test
  void physioGrantsComeFromRolePermissionsNotAHardcodedRoleName() {
    // CustomUserDetailsService always attaches both the ROLE_* authority and a
    // PERM_* authority per row_permissions grant, so a real PHYSIO user looks
    // like this — the PERM_ authority is what actually authorizes them, not
    // the bare role name.
    var withGrant = new UsernamePasswordAuthenticationToken("physio", "n/a",
        List.of(new SimpleGrantedAuthority("ROLE_PHYSIO"), new SimpleGrantedAuthority("PERM_COURSE_TRANSFER")));
    assertTrue(guard.hasAny(withGrant, "course.transfer"));
    assertFalse(guard.hasAny(withGrant, "settings.manage"));

    // The role name alone grants nothing: only ADMIN gets a hardcoded bypass.
    // Every other role's access lives entirely in role_permissions (V21/V22),
    // so editing it through the Role management screen actually takes effect.
    var withoutGrant = new UsernamePasswordAuthenticationToken("physio", "n/a",
        List.of(new SimpleGrantedAuthority("ROLE_PHYSIO")));
    assertFalse(guard.hasAny(withoutGrant, "course.transfer"));
  }
}
