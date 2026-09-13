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
  void preservesPhysioOperationalCompatibility() {
    var auth = new UsernamePasswordAuthenticationToken("physio", "n/a",
        List.of(new SimpleGrantedAuthority("ROLE_PHYSIO")));
    assertTrue(guard.hasAny(auth, "course.transfer"));
    assertFalse(guard.hasAny(auth, "settings.manage"));
  }
}
