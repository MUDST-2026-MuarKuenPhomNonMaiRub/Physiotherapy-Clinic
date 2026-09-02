package com.physiocare.clinic.auth;

import java.util.Set;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
public class AuthDataInitializer implements CommandLineRunner {
  private final AppUserRepository users;
  private final RoleRepository roles;
  private final PasswordEncoder encoder;

  @Value("${app.auth.bootstrap-admin-email:}")
  private String email;

  @Value("${app.auth.bootstrap-admin-password:}")
  private String password;

  public AuthDataInitializer(
      AppUserRepository users, RoleRepository roles, PasswordEncoder encoder) {
    this.users = users;
    this.roles = roles;
    this.encoder = encoder;
  }

  @Override
  public void run(String... args) {
    if (email.isBlank() || password.isBlank() || users.existsByEmailIgnoreCase(email)) {
      return;
    }

    Role admin = roles.findByCode("ADMIN").orElseThrow();
    AppUser user = new AppUser();
    user.setEmail(email.trim().toLowerCase());
    user.setPasswordHash(encoder.encode(password));
    user.setFirstName("System");
    user.setLastName("Administrator");
    user.setActive(true);
    user.setRoles(Set.of(admin));
    users.save(user);
  }
}
