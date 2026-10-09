package com.physiocare.clinic.controller;

import com.physiocare.clinic.service.AuthService;
import com.physiocare.clinic.service.PasswordResetService;
import com.physiocare.clinic.security.AuthCookies;

import com.physiocare.clinic.dto.auth.AuthDtos;

import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

  private final AuthService auth;
  private final AuthCookies cookies;
  private final PasswordResetService passwordReset;

  public AuthController(AuthService auth, AuthCookies cookies, PasswordResetService passwordReset) {
    this.auth = auth;
    this.cookies = cookies;
    this.passwordReset = passwordReset;
  }

  /** The token goes into an HttpOnly cookie and never into the response body. */
  @PostMapping("/login")
  public ResponseEntity<AuthDtos.LoginResponse> login(
      @Valid @RequestBody AuthDtos.LoginRequest request) {
    String token = auth.login(request);
    return ResponseEntity.ok()
        .header(HttpHeaders.SET_COOKIE, cookies.issue(token).toString())
        .body(new AuthDtos.LoginResponse(cookies.maxAgeSeconds()));
  }

  /**
   * Page script cannot delete an HttpOnly cookie, so signing out asks the API
   * to expire it. Open to everyone: clearing a cookie needs no proof of who you are.
   */
  @PostMapping("/logout")
  public ResponseEntity<Void> logout() {
    return ResponseEntity.noContent().header(HttpHeaders.SET_COOKIE, cookies.clear().toString()).build();
  }

  /** Always 202, whether or not the address has an account, so it cannot be used to probe for one. */
  @PostMapping("/password-reset/request")
  public ResponseEntity<Void> requestPasswordReset(
      @Valid @RequestBody AuthDtos.ForgotPasswordRequest request) {
    passwordReset.requestReset(request.email());
    return ResponseEntity.accepted().build();
  }

  @PostMapping("/password-reset/validate")
  public AuthDtos.ResetTokenStatus validatePasswordResetToken(
      @Valid @RequestBody AuthDtos.ResetTokenRequest request) {
    return new AuthDtos.ResetTokenStatus(passwordReset.isUsable(request.token()));
  }

  @PostMapping("/password-reset/confirm")
  public ResponseEntity<Void> confirmPasswordReset(
      @Valid @RequestBody AuthDtos.ResetPasswordRequest request) {
    passwordReset.resetPassword(request.token(), request.password());
    return ResponseEntity.noContent().build();
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
