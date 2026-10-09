package com.physiocare.clinic.security;

import com.physiocare.clinic.repository.AppUserRepository;

import com.physiocare.clinic.model.AppUser;

import java.util.stream.Collectors;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.*;
import org.springframework.stereotype.Service;
import org.springframework.jdbc.core.JdbcTemplate;

@Service
public class CustomUserDetailsService implements UserDetailsService {

  private final AppUserRepository users;
  private final JdbcTemplate db;

  public CustomUserDetailsService(AppUserRepository users, JdbcTemplate db) {
    this.users = users;
    this.db = db;
  }

  @Override
  public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
    AppUser user =
        users
            .findByEmailIgnoreCaseAndDeletedAtIsNull(email)
            .orElseThrow(() -> new UsernameNotFoundException("Invalid credentials"));
    return toDetails(user);
  }

  /**
   * Loads the account behind a session cookie, refusing a session that was
   * issued before the password last changed. JWT times are whole seconds, so
   * the change time is compared at the same precision.
   */
  public UserDetails loadForSession(String email, java.time.Instant issuedAt) {
    AppUser user =
        users
            .findByEmailIgnoreCaseAndDeletedAtIsNull(email)
            .orElseThrow(() -> new UsernameNotFoundException("Invalid credentials"));
    java.time.OffsetDateTime changedAt = user.getPasswordChangedAt();
    if (changedAt != null
        && issuedAt.isBefore(changedAt.toInstant().truncatedTo(java.time.temporal.ChronoUnit.SECONDS))) {
      throw new UsernameNotFoundException("Session predates the last password change");
    }
    return toDetails(user);
  }

  private UserDetails toDetails(AppUser user) {
    return User.withUsername(user.getEmail())
        .password(user.getPasswordHash())
        .disabled(!user.isActive())
        .authorities(authoritiesFor(user))
        .build();
  }

  private java.util.Set<SimpleGrantedAuthority> authoritiesFor(AppUser user) {
    java.util.Set<SimpleGrantedAuthority> authorities = user.getRoles().stream()
        .map(role -> new SimpleGrantedAuthority("ROLE_" + role.getCode()))
        .collect(Collectors.toSet());
    db.query("SELECT DISTINCT p.code FROM permissions p JOIN role_permissions rp ON rp.permission_id=p.id JOIN user_roles ur ON ur.role_id=rp.role_id WHERE ur.user_id=? AND p.active=true", (org.springframework.jdbc.core.RowCallbackHandler) rs -> authorities.add(new SimpleGrantedAuthority("PERM_" + rs.getString("code").toUpperCase().replace('.', '_'))), user.getId());
    return authorities;
  }
}
