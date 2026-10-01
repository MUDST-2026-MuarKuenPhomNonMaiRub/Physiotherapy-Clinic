package com.physiocare.clinic.auth;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Duration;
import java.util.Optional;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

/**
 * The signed-in session travels as an HttpOnly cookie rather than a token the
 * page keeps. Script running in the page can never read it, so a cross-site
 * scripting bug cannot carry the session off to another machine.
 *
 * <p>SameSite=Strict keeps the browser from attaching it to a request that
 * another site starts, which is what makes a cookie session safe from
 * cross-site request forgery without a separate CSRF token. The path limits it
 * to the API; the pages themselves never need it.
 */
@Component
public class AuthCookies {
  public static final String NAME = "clinic_session";

  private final boolean secure;
  private final Duration maxAge;

  public AuthCookies(
      @Value("${app.security.cookie.secure:true}") boolean secure,
      @Value("${app.security.jwt.expiration-ms:3600000}") long expirationMs) {
    this.secure = secure;
    this.maxAge = Duration.ofMillis(expirationMs);
  }

  public ResponseCookie issue(String token) {
    return build(token, maxAge);
  }

  /** An expired, empty cookie: the browser drops the session on receiving it. */
  public ResponseCookie clear() {
    return build("", Duration.ZERO);
  }

  public Optional<String> read(HttpServletRequest request) {
    Cookie[] cookies = request.getCookies();
    if (cookies == null) return Optional.empty();
    for (Cookie cookie : cookies) {
      if (NAME.equals(cookie.getName()) && !cookie.getValue().isBlank()) {
        return Optional.of(cookie.getValue());
      }
    }
    return Optional.empty();
  }

  public long maxAgeSeconds() {
    return maxAge.toSeconds();
  }

  private ResponseCookie build(String value, Duration age) {
    return ResponseCookie.from(NAME, value)
        .httpOnly(true)
        .secure(secure)
        .sameSite("Strict")
        .path("/api")
        .maxAge(age)
        .build();
  }
}
