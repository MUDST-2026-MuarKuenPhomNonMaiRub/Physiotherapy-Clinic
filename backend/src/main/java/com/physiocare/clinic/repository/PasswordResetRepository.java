package com.physiocare.clinic.repository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Database operations for email password reset tokens. */
@Repository
public class PasswordResetRepository {
  private final JdbcTemplate db;

  public PasswordResetRepository(JdbcTemplate db) {
    this.db = db;
  }

  public int countRequestedSince(long userId, OffsetDateTime since) {
    Integer count =
        db.queryForObject(
            "SELECT count(*) FROM password_reset_tokens WHERE user_id=? AND created_at > ?",
            Integer.class,
            userId,
            since);
    return count == null ? 0 : count;
  }

  /** Only the newest link works; asking again retires every earlier one. */
  public void retireOpenTokens(long userId) {
    db.update(
        "UPDATE password_reset_tokens SET used_at=now() WHERE user_id=? AND used_at IS NULL",
        userId);
  }

  public void insert(long userId, String tokenHash, OffsetDateTime expiresAt) {
    db.update(
        "INSERT INTO password_reset_tokens(user_id,token_hash,expires_at) VALUES(?,?,?)",
        userId,
        tokenHash,
        expiresAt);
  }

  /** The owner of a token that is unused and unexpired, locked until the transaction ends. */
  public Optional<Long> lockUsableTokenOwner(String tokenHash) {
    List<Long> owners =
        db.queryForList(
            "SELECT user_id FROM password_reset_tokens WHERE token_hash=? AND used_at IS NULL"
                + " AND expires_at > now() FOR UPDATE",
            Long.class,
            tokenHash);
    return owners.stream().findFirst();
  }

  public boolean isUsable(String tokenHash) {
    Boolean usable =
        db.queryForObject(
            "SELECT EXISTS(SELECT 1 FROM password_reset_tokens t JOIN users u ON u.id=t.user_id"
                + " WHERE t.token_hash=? AND t.used_at IS NULL AND t.expires_at > now()"
                + " AND u.active AND u.deleted_at IS NULL)",
            Boolean.class,
            tokenHash);
    return Boolean.TRUE.equals(usable);
  }

  public void updatePassword(long userId, String passwordHash) {
    db.update(
        "UPDATE users SET password_hash=?, password_changed_at=now(), updated_at=now() WHERE id=?",
        passwordHash,
        userId);
  }

  public void clearLoginLockout(String email) {
    db.update("DELETE FROM login_rate_limits WHERE email=?", email);
  }
}
