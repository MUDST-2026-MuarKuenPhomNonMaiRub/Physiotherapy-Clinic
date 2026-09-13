package com.physiocare.clinic.auth;

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
