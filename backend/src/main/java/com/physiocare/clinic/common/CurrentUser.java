package com.physiocare.clinic.common;

import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;

/** Resolves the signed-in account to the ids and display name that writes record. */
@Service
public class CurrentUser {
  private final JdbcTemplate db;

  public CurrentUser(JdbcTemplate db) {
    this.db = db;
  }

  public Long id(Authentication authentication) {
    if (authentication == null || authentication.getName() == null) return null;
    try {
      return db.queryForObject(
          "SELECT id FROM users WHERE lower(email)=lower(?) AND deleted_at IS NULL",
          Long.class,
          authentication.getName());
    } catch (EmptyResultDataAccessException e) {
      return null;
    }
  }

  /** The staff record behind the account, or null for an account with no staff profile. */
  public Long staffId(Authentication authentication) {
    Long userId = id(authentication);
    if (userId == null) return null;
    try {
      return db.queryForObject(
          "SELECT id FROM staff WHERE user_id=? AND deleted_at IS NULL", Long.class, userId);
    } catch (EmptyResultDataAccessException e) {
      return null;
    }
  }

  /** The name shown on a ledger entry or a void record. */
  public String displayName(Authentication authentication) {
    if (authentication == null || authentication.getName() == null) return "System";
    try {
      String name =
          db.queryForObject(
              "SELECT COALESCE(NULLIF(trim(s.name), ''), trim(u.first_name || ' ' ||"
                  + " u.last_name)) FROM users u LEFT JOIN staff s ON s.user_id=u.id AND"
                  + " s.deleted_at IS NULL WHERE lower(u.email)=lower(?) AND u.deleted_at IS NULL",
              String.class,
              authentication.getName());
      return name == null || name.isBlank() ? authentication.getName() : name;
    } catch (EmptyResultDataAccessException e) {
      return authentication.getName();
    }
  }

  public boolean isAdmin(Authentication authentication) {
    return authentication != null
        && authentication.getAuthorities().stream()
            .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
  }
}
