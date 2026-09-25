package com.physiocare.clinic.auth;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Service;

/**
 * Carries the session JWT in an HttpOnly cookie, so no script running in the
 * page — including one injected through an XSS hole — can read the token.
 */
@Service
public class AuthCookieService {
  private static final String BEARER_PREFIX = "Bearer ";

  private final String name;
  private final boolean secure;
  private final String sameSite;

  public AuthCookieService(
      @Value("${app.security.cookie.name:physiocare_session}") String name,
      @Value("${app.security.cookie.secure:true}") boolean secure,
      @Value("${app.security.cookie.same-site:Strict}") String sameSite) {
    this.name = name;
    this.secure = secure;
    this.sameSite = sameSite;
  }

  public ResponseCookie sessionCookie(String token, long maxAgeSeconds) {
    return base(token).maxAge(Duration.ofSeconds(maxAgeSeconds)).build();
  }

  /** An already-expired cookie of the same name and path, which the browser drops. */
  public ResponseCookie clearedCookie() {
    return base("").maxAge(Duration.ZERO).build();
  }

  /**
   * The cookie is what the browser sends. The Authorization header is still read
   * so tools such as Postman or curl can call the API without a browser.
   */
  public String resolveToken(HttpServletRequest request) {
    Cookie[] cookies = request.getCookies();
    if (cookies != null) {
      for (Cookie cookie : cookies) {
        if (name.equals(cookie.getName()) && !cookie.getValue().isBlank()) {
          return cookie.getValue();
        }
      }
    }
    String header = request.getHeader("Authorization");
    if (header != null && header.startsWith(BEARER_PREFIX)) {
      return header.substring(BEARER_PREFIX.length());
    }
    return null;
  }

  private ResponseCookie.ResponseCookieBuilder base(String value) {
    // Path /api: the token goes only to the API, never with page or asset requests.
    return ResponseCookie.from(name, value)
        .httpOnly(true)
        .secure(secure)
        .sameSite(sameSite)
        .path("/api");
  }
}
