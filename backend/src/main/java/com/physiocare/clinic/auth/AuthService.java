package com.physiocare.clinic.auth;

import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AuthService {
  private final AuthenticationManager authenticationManager;
  private final AppUserRepository users;
  private final JwtService jwt;
  private final RoleRepository roles;
  private final PasswordEncoder encoder;

  public AuthService(
      AuthenticationManager authenticationManager,
      AppUserRepository users,
      JwtService jwt,
      RoleRepository roles,
      PasswordEncoder encoder) {
    this.authenticationManager = authenticationManager;
    this.users = users;
    this.jwt = jwt;
    this.roles = roles;
    this.encoder = encoder;
  }

  public AuthDtos.LoginResponse login(AuthDtos.LoginRequest request) {
    authenticationManager.authenticate(
        new UsernamePasswordAuthenticationToken(request.email(), request.password()));

    AppUser user = users.findByEmailIgnoreCaseAndDeletedAtIsNull(request.email()).orElseThrow();
    return new AuthDtos.LoginResponse(
        jwt.generateToken(user), "Bearer", jwt.getExpirationMs() / 1000);
  }

  public AuthDtos.MeResponse me(String email) {
    AppUser user = users.findByEmailIgnoreCaseAndDeletedAtIsNull(email).orElseThrow();
    return new AuthDtos.MeResponse(
        user.getId(),
        user.getEmail(),
        user.getFirstName(),
        user.getLastName(),
        user.isActive(),
        user.getRoles().stream().map(Role::getCode).collect(Collectors.toSet()));
  }

  public void createUser(AuthDtos.CreateUserRequest request) {
    String email = request.email().trim().toLowerCase();
    if (users.existsByEmailIgnoreCase(email)) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "Email is already in use");
    }

    String roleCode =
        request.role().trim().equals("PHYSIOTHERAPIST") ? "PHYSIO" : request.role().trim();
    if (!roleCode.equals("ADMIN") && !roleCode.equals("PHYSIO")) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported role");
    }

    Role role =
        roles
            .findByCode(roleCode)
            .orElseThrow(
                () -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Role not found"));
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
