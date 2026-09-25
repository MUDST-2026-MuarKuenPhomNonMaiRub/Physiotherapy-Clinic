package com.physiocare.clinic.auth;

import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import java.time.Duration;

@Service
public class AuthService {
  private final AuthenticationManager authenticationManager;
  private final AppUserRepository users;
  private final JwtService jwt;
  private final RoleRepository roles;
  private final PasswordEncoder encoder;
  private final JdbcTemplate db;
  private static final int MAX_FAILED_ATTEMPTS = 5;
  private static final Duration LOCKOUT = Duration.ofMinutes(10);

  public AuthService(
      AuthenticationManager authenticationManager,
      AppUserRepository users,
      JwtService jwt,
      RoleRepository roles,
      PasswordEncoder encoder,
      JdbcTemplate db) {
    this.authenticationManager = authenticationManager;
    this.users = users;
    this.jwt = jwt;
    this.roles = roles;
    this.encoder = encoder;
    this.db = db;
  }

  public AuthDtos.LoginResult login(AuthDtos.LoginRequest request) {
    String email = request.email().trim().toLowerCase();
    Integer blocked = db.queryForObject("SELECT count(*) FROM login_rate_limits WHERE email=? AND blocked_until > now()", Integer.class, email);
    if (blocked != null && blocked > 0) {
      throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Too many login attempts");
    }
    try {
      authenticationManager.authenticate(
          new UsernamePasswordAuthenticationToken(email, request.password()));
      db.update("DELETE FROM login_rate_limits WHERE email=?", email);
    } catch (org.springframework.security.core.AuthenticationException e) {
      db.update("INSERT INTO login_rate_limits(email,failure_count,blocked_until,last_attempt_at) VALUES(?,1,NULL,now()) ON CONFLICT(email) DO UPDATE SET failure_count=CASE WHEN login_rate_limits.last_attempt_at < now() - (? * interval '1 second') THEN 1 ELSE login_rate_limits.failure_count + 1 END, blocked_until=CASE WHEN (CASE WHEN login_rate_limits.last_attempt_at < now() - (? * interval '1 second') THEN 1 ELSE login_rate_limits.failure_count + 1 END) >= ? THEN now() + (? * interval '1 second') ELSE login_rate_limits.blocked_until END, last_attempt_at=now()", email, LOCKOUT.toSeconds(), LOCKOUT.toSeconds(), MAX_FAILED_ATTEMPTS, LOCKOUT.toSeconds());
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials");
    }

    AppUser user = users.findByEmailIgnoreCaseAndDeletedAtIsNull(email).orElseThrow();
    db.update("UPDATE users SET last_login=now() WHERE id=?", user.getId());
    return new AuthDtos.LoginResult(jwt.generateToken(user), jwt.getExpirationMs() / 1000);
  }

  public AuthDtos.MeResponse me(String email) {
    AppUser user = users.findByEmailIgnoreCaseAndDeletedAtIsNull(email).orElseThrow();
    java.util.List<Long> staffIds =
        db.queryForList(
            "SELECT id FROM staff WHERE user_id=? AND deleted_at IS NULL", Long.class, user.getId());
    java.util.List<Long> branchIds =
        db.queryForList(
            "SELECT branch_id FROM user_branches WHERE user_id=? ORDER BY is_default DESC,"
                + " branch_id",
            Long.class,
            user.getId());
    return new AuthDtos.MeResponse(
        user.getId(),
        user.getEmail(),
        user.getFirstName(),
        user.getLastName(),
        user.isActive(),
        // A plain Set has no serialization order, and the frontend treats the
        // first entry as the user's primary role — so a deterministic order
        // (highest-privilege role first) is a correctness requirement here,
        // not cosmetic.
        user.getRoles().stream()
            .map(Role::getCode)
            .sorted(
                java.util.Comparator.<String, Integer>comparing(
                        code -> "ADMIN".equals(code) ? 0 : 1)
                    .thenComparing(java.util.Comparator.naturalOrder()))
            .collect(Collectors.toCollection(java.util.LinkedHashSet::new)),
        new java.util.HashSet<>(db.queryForList("SELECT DISTINCT p.code FROM permissions p JOIN role_permissions rp ON rp.permission_id=p.id JOIN user_roles ur ON ur.role_id=rp.role_id WHERE ur.user_id=? AND p.active=true ORDER BY p.code", String.class, user.getId())),
        staffIds.isEmpty() ? null : staffIds.get(0),
        branchIds);
  }

  public void createUser(AuthDtos.CreateUserRequest request) {
    String email = request.email().trim().toLowerCase();
    if (users.existsByEmailIgnoreCase(email)) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "Email is already in use");
    }

    // Roles are data, not an application enum. Keep the current aliases for
    // the UI, but allow an administrator to use any active role configured in
    // the roles table so new job functions do not require a backend release.
    String roleCode = request.role().trim().toUpperCase();
    if (roleCode.equals("PHYSIOTHERAPIST")) roleCode = "PHYSIO";

    Role role =
        roles
            .findByCode(roleCode)
            .orElseThrow(
                () -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Role is not configured"));
    AppUser user = new AppUser();
    user.setEmail(email);
    user.setPasswordHash(encoder.encode(request.password()));
    user.setFirstName(request.firstName().trim());
    user.setLastName(request.lastName().trim());
    user.setActive(true);
    user.setRoles(Set.of(role));
    users.save(user);
  }
}
