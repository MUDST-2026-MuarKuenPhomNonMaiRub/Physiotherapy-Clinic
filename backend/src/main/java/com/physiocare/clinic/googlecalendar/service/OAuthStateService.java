package com.physiocare.clinic.googlecalendar.service;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.util.Date;
import java.util.UUID;
import javax.crypto.SecretKey;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Signs the OAuth {@code state} parameter. The browser leaves the app for
 * Google's consent screen and comes back without the login token, so the state
 * is what tells the callback whose calendar is being linked — and proves the
 * round trip started here. The key is derived from the login secret under its
 * own label, so a state can never pass as a login token or the other way round.
 */
@Service
public class OAuthStateService {
  private static final String PURPOSE = "google-calendar-connect";
  private static final Duration LIFETIME = Duration.ofMinutes(10);

  private final SecretKey key;

  public OAuthStateService(@Value("${app.security.jwt.secret}") String jwtSecret) {
    try {
      byte[] derived = MessageDigest.getInstance("SHA-256")
          .digest((PURPOSE + ":" + jwtSecret).getBytes(StandardCharsets.UTF_8));
      this.key = Keys.hmacShaKeyFor(derived);
    } catch (Exception e) {
      throw new IllegalStateException("Unable to initialise the OAuth state key", e);
    }
  }

  public record State(long staffId, long userId) {}

  public String issue(long staffId, long userId) {
    Date now = new Date();
    return Jwts.builder()
        .id(UUID.randomUUID().toString())
        .claim("purpose", PURPOSE)
        .claim("staffId", staffId)
        .claim("userId", userId)
        .issuedAt(now)
        .expiration(new Date(now.getTime() + LIFETIME.toMillis()))
        .signWith(key)
        .compact();
  }

  /** @throws IllegalArgumentException when the state is forged, altered or expired */
  public State verify(String state) {
    try {
      Claims claims = Jwts.parser().verifyWith(key).build().parseSignedClaims(state).getPayload();
      if (!PURPOSE.equals(claims.get("purpose", String.class))) {
        throw new IllegalArgumentException("Invalid OAuth state");
      }
      return new State(
          claims.get("staffId", Number.class).longValue(),
          claims.get("userId", Number.class).longValue());
    } catch (JwtException | NullPointerException e) {
      throw new IllegalArgumentException("Invalid or expired OAuth state", e);
    }
  }
}
