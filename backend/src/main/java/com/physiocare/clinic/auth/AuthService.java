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
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

@Service
public class AuthService {
  private final AuthenticationManager authenticationManager;
  private final AppUserRepository users;
  private final JwtService jwt;
  private final RoleRepository roles;
  private final PasswordEncoder encoder;
  private final JdbcTemplate db;
  private final ConcurrentHashMap<String, LoginAttempt> loginAttempts = new ConcurrentHashMap<>();
  private static final int MAX_FAILED_ATTEMPTS = 5;
  private static final Duration LOCKOUT = Duration.ofMinutes(10);

  private record LoginAttempt(AtomicInteger failures, long blockedUntil) {}

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

  public AuthDtos.LoginResponse login(AuthDtos.LoginRequest request) {
    String email = request.email().trim().toLowerCase();
    LoginAttempt attempt = loginAttempts.get(email);
    if (attempt != null && attempt.blockedUntil() > System.currentTimeMillis()) {
      throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Too many login attempts");
    }
    try {
      authenticationManager.authenticate(
          new UsernamePasswordAuthenticationToken(email, request.password()));
      loginAttempts.remove(email);
    } catch (org.springframework.security.core.AuthenticationException e) {
      LoginAttempt current = loginAttempts.computeIfAbsent(email, k -> new LoginAttempt(new AtomicInteger(), 0));
      int failures = current.failures().incrementAndGet();
      if (failures >= MAX_FAILED_ATTEMPTS) {
        loginAttempts.put(email, new LoginAttempt(current.failures(), System.currentTimeMillis() + LOCKOUT.toMillis()));
      }
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials");
    }

    AppUser user = users.findByEmailIgnoreCaseAndDeletedAtIsNull(email).orElseThrow();
    db.update("UPDATE users SET last_login=now() WHERE id=?", user.getId());
    return new AuthDtos.LoginResponse(
        jwt.generateToken(user), "Bearer", jwt.getExpirationMs() / 1000);
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
        user.getRoles().stream().map(Role::getCode).collect(Collectors.toSet()),
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
