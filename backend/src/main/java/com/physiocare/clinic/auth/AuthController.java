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
  private final AuthCookies cookies;

  public AuthController(AuthService auth, AuthCookies cookies) {
    this.auth = auth;
    this.cookies = cookies;
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
