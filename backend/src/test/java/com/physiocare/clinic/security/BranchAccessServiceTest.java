package com.physiocare.clinic.security;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

class BranchAccessServiceTest {
  private final JdbcTemplate db = mock(JdbcTemplate.class);
  private final BranchAccessService service = new BranchAccessService(db);

  @Test
  void databaseAdminCanReadWithoutSelectingABranchEvenWhenRoleAuthorityIsMissing() {
    Authentication admin = authentication("admin@example.com", "PERM_PATIENT_VIEW");
    when(db.queryForObject(anyString(), eq(Integer.class), eq("admin@example.com")))
        .thenReturn(1);

    assertDoesNotThrow(() -> service.requireFilter(admin, null));
  }

  @Test
  void nonAdminStillMustProvideAnAllowedBranch() {
    Authentication staff = authentication("staff@example.com", "PERM_PATIENT_VIEW");
    when(db.queryForObject(anyString(), eq(Integer.class), eq("staff@example.com")))
        .thenReturn(0);

    assertThrows(IllegalArgumentException.class, () -> service.requireFilter(staff, null));
  }

  private static Authentication authentication(String email, String authority) {
    return new UsernamePasswordAuthenticationToken(
        email, "n/a", List.of(new SimpleGrantedAuthority(authority)));
  }
}
