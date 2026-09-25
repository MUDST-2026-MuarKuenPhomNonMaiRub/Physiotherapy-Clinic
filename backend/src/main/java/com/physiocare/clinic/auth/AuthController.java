package com.physiocare.clinic.auth;

import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

  private final AuthService auth;

  public AuthController(AuthService auth) {
    this.auth = auth;
  }

  @PostMapping("/login")
  public AuthDtos.LoginResponse login(@Valid @RequestBody AuthDtos.LoginRequest request) {
    return auth.login(request);
  }

  /** Account creation is an administration action, never open to every signed-in user. */
  @PostMapping("/users")
  @PreAuthorize("@permissionGuard.hasAny(authentication, 'settings.manage')")
  public void createUser(@Valid @RequestBody AuthDtos.CreateUserRequest request) {
    auth.createUser(request);
  }

  @GetMapping("/me")
  public AuthDtos.MeResponse me(Authentication authentication) {
    return auth.me(authentication.getName());
  }
}
