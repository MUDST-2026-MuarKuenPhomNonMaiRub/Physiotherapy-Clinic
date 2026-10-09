package com.physiocare.clinic.service;

import com.physiocare.clinic.model.AppUser;
import com.physiocare.clinic.repository.AppUserRepository;
import com.physiocare.clinic.repository.PasswordResetRepository;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.HexFormat;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.server.ResponseStatusException;

/**
 * Email-link password reset. The caller is never told whether an address has
 * an account: every request gets the same answer, and the mail goes out after
 * the response.
 */
@Service
public class PasswordResetService {
  /** Enough to cover a mistyped first try, not enough to flood an inbox. */
  static final int MAX_REQUESTS_PER_WINDOW = 3;
  static final long REQUEST_WINDOW_MINUTES = 15;

  private static final SecureRandom RANDOM = new SecureRandom();
  private static final String INVALID_LINK = "This reset link is invalid or has expired";

  private final AppUserRepository users;
  private final PasswordResetRepository resets;
  private final PasswordResetMailer mailer;
  private final PasswordEncoder encoder;
  private final AuditService audit;
  private final String frontendUrl;
  private final long ttlMinutes;

  public PasswordResetService(
      AppUserRepository users,
      PasswordResetRepository resets,
      PasswordResetMailer mailer,
      PasswordEncoder encoder,
      AuditService audit,
      @Value("${app.frontend-url}") String frontendUrl,
      @Value("${app.password-reset.token-ttl-minutes:30}") long ttlMinutes) {
    this.users = users;
    this.resets = resets;
    this.mailer = mailer;
    this.encoder = encoder;
    this.audit = audit;
    this.frontendUrl = frontendUrl.replaceAll("/+$", "");
    this.ttlMinutes = ttlMinutes;
  }

  @Transactional
  public void requestReset(String rawEmail) {
    String email = rawEmail.trim().toLowerCase();
    AppUser user = users.findByEmailIgnoreCaseAndDeletedAtIsNull(email).orElse(null);
    if (user == null || !user.isActive()) return;
    OffsetDateTime windowStart = OffsetDateTime.now().minusMinutes(REQUEST_WINDOW_MINUTES);
    if (resets.countRequestedSince(user.getId(), windowStart) >= MAX_REQUESTS_PER_WINDOW) return;

    String token = newToken();
    resets.retireOpenTokens(user.getId());
    resets.insert(user.getId(), hash(token), OffsetDateTime.now().plusMinutes(ttlMinutes));

    String link = frontendUrl + "/reset-password?token=" + token;
    String to = user.getEmail();
    String name = user.getFirstName();
    TransactionSynchronizationManager.registerSynchronization(
        new TransactionSynchronization() {
          @Override
          public void afterCommit() {
            mailer.sendAsync(to, name, link, ttlMinutes);
          }
        });
  }

  public boolean isUsable(String token) {
    return token != null && !token.isBlank() && resets.isUsable(hash(token));
  }

  @Transactional
  public void resetPassword(String token, String newPassword) {
    if (token == null || token.isBlank()) throw invalidLink();
    String tokenHash = hash(token);
    long userId = resets.lockUsableTokenOwner(tokenHash).orElseThrow(PasswordResetService::invalidLink);
    AppUser user =
        users
            .findById(userId)
            .filter(candidate -> candidate.isActive() && candidate.getDeletedAt() == null)
            .orElseThrow(PasswordResetService::invalidLink);

    resets.updatePassword(userId, encoder.encode(newPassword));
    resets.retireOpenTokens(userId);
    resets.clearLoginLockout(user.getEmail());
    audit.record(
        userId, null, "PASSWORD_RESET", "USER", String.valueOf(userId), null, null,
        "Password reset through the emailed link");
  }

  private static ResponseStatusException invalidLink() {
    return new ResponseStatusException(HttpStatus.BAD_REQUEST, INVALID_LINK);
  }

  private static String newToken() {
    byte[] bytes = new byte[32];
    RANDOM.nextBytes(bytes);
    return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
  }

  static String hash(String token) {
    try {
      byte[] digest =
          MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8));
      return HexFormat.of().formatHex(digest);
    } catch (NoSuchAlgorithmException e) {
      throw new IllegalStateException("SHA-256 is unavailable", e);
    }
  }
}
