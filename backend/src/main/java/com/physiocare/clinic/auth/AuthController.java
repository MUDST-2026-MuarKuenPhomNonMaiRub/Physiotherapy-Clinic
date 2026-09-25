package com.physiocare.clinic.auth;

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
  private final AuthCookieService cookies;

  public AuthController(AuthService auth, AuthCookieService cookies) {
    this.auth = auth;
    this.cookies = cookies;
  }

  @PostMapping("/login")
  public ResponseEntity<AuthDtos.LoginResponse> login(
      @Valid @RequestBody AuthDtos.LoginRequest request) {
    AuthDtos.LoginResult result = auth.login(request);
    return ResponseEntity.ok()
        .header(
            HttpHeaders.SET_COOKIE,
            cookies.sessionCookie(result.token(), result.expiresIn()).toString())
        .body(new AuthDtos.LoginResponse(result.expiresIn()));
  }

  /**
   * Open to anyone, so a browser holding an expired cookie can still be told to
   * drop it. Script cannot clear an HttpOnly cookie itself.
   */
  @PostMapping("/logout")
  public ResponseEntity<Void> logout() {
    return ResponseEntity.noContent()
        .header(HttpHeaders.SET_COOKIE, cookies.clearedCookie().toString())
        .build();
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
