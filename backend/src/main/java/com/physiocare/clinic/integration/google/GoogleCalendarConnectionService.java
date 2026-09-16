package com.physiocare.clinic.integration.google;

import com.physiocare.clinic.common.AuditService;
import com.physiocare.clinic.patient.PiiCryptoService;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * Links a staff member to their own Google account (OAuth authorisation
 * code flow) and hands out access tokens for the push. Only the person
 * behind the staff record can start a connection — it is their Google login
 * — while an administrator may cut one at any time.
 */
@Service
public class GoogleCalendarConnectionService {
  /** Enough to write events; "email" so the linked address can be shown. */
  static final String SCOPES = "https://www.googleapis.com/auth/calendar.events openid email";
  private static final long STATE_TTL_SECONDS = 600;

  public record Connection(long staffId, String calendarId, String refreshToken) {}

  public record Status(
      boolean configured,
      boolean connected,
      String googleEmail,
      Instant connectedAt,
      String lastError,
      Instant lastErrorAt) {}

  private record CachedToken(String accessToken, Instant expiresAt) {}

  private final JdbcTemplate db;
  private final GoogleSettings settings;
  private final GoogleApiClient google;
  private final PiiCryptoService crypto;
  private final AuditService audit;
  private final SecureRandom random = new SecureRandom();
  private final Map<Long, CachedToken> accessTokens = new ConcurrentHashMap<>();

  public GoogleCalendarConnectionService(
      JdbcTemplate db,
      GoogleSettings settings,
      GoogleApiClient google,
      PiiCryptoService crypto,
      AuditService audit) {
    this.db = db;
    this.settings = settings;
    this.google = google;
    this.crypto = crypto;
    this.audit = audit;
  }

  public Status status(long staffId) {
    List<Map<String, Object>> rows =
        db.queryForList(
            "SELECT google_email,connected_at,last_error,last_error_at FROM staff_google_calendars"
                + " WHERE staff_id=?",
            staffId);
    if (rows.isEmpty()) return new Status(settings.configured(), false, null, null, null, null);
    Map<String, Object> row = rows.get(0);
    return new Status(
        settings.configured(),
        true,
        (String) row.get("google_email"),
        instant(row.get("connected_at")),
        (String) row.get("last_error"),
        instant(row.get("last_error_at")));
  }

  /** The Google consent page for this staff member, with a one-time state tying the answer back to them. */
  @Transactional
  public String authorizationUrl(long staffId, long userId) {
    requireConfigured();
    byte[] bytes = new byte[32];
    random.nextBytes(bytes);
    String state = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    db.update(
        "DELETE FROM google_oauth_states WHERE created_at < now() - interval '1 hour' OR staff_id=?",
        staffId);
    db.update(
        "INSERT INTO google_oauth_states(state,staff_id,user_id) VALUES(?,?,?)", state, staffId, userId);
    return "https://accounts.google.com/o/oauth2/v2/auth"
        + "?client_id=" + encode(settings.clientId())
        + "&redirect_uri=" + encode(settings.redirectUri())
        + "&response_type=code"
        + "&scope=" + encode(SCOPES)
        + "&access_type=offline"
        // Google only re-issues a refresh token when consent is shown again,
        // so a reconnect after a disconnect must ask every time.
        + "&prompt=consent"
        + "&state=" + encode(state);
  }

  /**
   * Google's redirect back. Returns the staff id the code was for, so the
   * caller can queue the backfill of their upcoming appointments.
   */
  @Transactional
  public long completeConnection(String state, String code) {
    requireConfigured();
    List<Map<String, Object>> rows =
        db.queryForList(
            "DELETE FROM google_oauth_states WHERE state=? AND created_at > now() - (? * interval '1 second')"
                + " RETURNING staff_id,user_id",
            state, STATE_TTL_SECONDS);
    if (rows.isEmpty())
      throw new IllegalArgumentException("This Google sign-in link has expired. Start the connection again.");
    long staffId = ((Number) rows.get(0).get("staff_id")).longValue();
    long userId = ((Number) rows.get(0).get("user_id")).longValue();

    GoogleApiClient.Tokens tokens = google.exchangeCode(code);
    if (tokens.refreshToken() == null || tokens.refreshToken().isBlank())
      throw new IllegalArgumentException(
          "Google did not grant offline access. Remove LA BALANCE from your Google account's"
              + " third-party access and connect again.");
    String email = null;
    try {
      email = google.email(tokens.accessToken());
    } catch (RuntimeException ignored) {
      // The address is informational; the connection works without it.
    }

    db.update(
        "INSERT INTO staff_google_calendars(staff_id,google_email,refresh_token_ciphertext,connected_by,"
            + "connected_at,last_error,last_error_at) VALUES(?,?,?,?,now(),NULL,NULL)"
            + " ON CONFLICT (staff_id) DO UPDATE SET google_email=EXCLUDED.google_email,"
            + " refresh_token_ciphertext=EXCLUDED.refresh_token_ciphertext,"
            + " connected_by=EXCLUDED.connected_by, connected_at=now(), last_error=NULL, last_error_at=NULL",
        staffId, email, crypto.encrypt(tokens.refreshToken()), userId);
    accessTokens.put(
        staffId,
        new CachedToken(tokens.accessToken(), Instant.now().plusSeconds(tokens.expiresInSeconds() - 60)));
    audit.record(userId, null, "GOOGLE_CALENDAR_CONNECTED", "staff", String.valueOf(staffId), null,
        Map.of("googleEmail", email == null ? "" : email), "Google Calendar connected");
    return staffId;
  }

  /** Drops the stored grant. The caller removes the events first while the token still works. */
  @Transactional
  public void disconnect(long staffId, Long actorUserId, String reason) {
    Optional<Connection> connection = connection(staffId);
    if (connection.isEmpty()) return;
    google.revoke(connection.get().refreshToken());
    db.update("DELETE FROM staff_google_calendars WHERE staff_id=?", staffId);
    accessTokens.remove(staffId);
    audit.record(actorUserId, null, "GOOGLE_CALENDAR_DISCONNECTED", "staff", String.valueOf(staffId),
        null, null, reason);
  }

  public Optional<Connection> connection(long staffId) {
    return db.queryForList(
            "SELECT calendar_id,refresh_token_ciphertext FROM staff_google_calendars WHERE staff_id=?",
            staffId)
        .stream()
        .findFirst()
        .map(
            row ->
                new Connection(
                    staffId,
                    (String) row.get("calendar_id"),
                    crypto.decrypt((String) row.get("refresh_token_ciphertext"))));
  }

  public boolean isConnected(long staffId) {
    return Boolean.TRUE.equals(
        db.queryForObject(
            "SELECT EXISTS(SELECT 1 FROM staff_google_calendars WHERE staff_id=?)", Boolean.class, staffId));
  }

  /** A usable access token, refreshed from the stored grant when the cached one is about to lapse. */
  public String accessToken(Connection connection) {
    CachedToken cached = accessTokens.get(connection.staffId());
    if (cached != null && cached.expiresAt().isAfter(Instant.now())) return cached.accessToken();
    GoogleApiClient.Tokens tokens = google.refresh(connection.refreshToken());
    accessTokens.put(
        connection.staffId(),
        new CachedToken(tokens.accessToken(), Instant.now().plusSeconds(tokens.expiresInSeconds() - 60)));
    return tokens.accessToken();
  }

  public void forgetAccessToken(long staffId) {
    accessTokens.remove(staffId);
  }

  public void recordError(long staffId, String message) {
    db.update(
        "UPDATE staff_google_calendars SET last_error=?, last_error_at=now() WHERE staff_id=?",
        message, staffId);
  }

  public void clearError(long staffId) {
    db.update(
        "UPDATE staff_google_calendars SET last_error=NULL, last_error_at=NULL WHERE staff_id=?"
            + " AND last_error IS NOT NULL",
        staffId);
  }

  public String frontendUrl() {
    return settings.frontendUrl();
  }

  private void requireConfigured() {
    if (!settings.configured())
      throw new ResponseStatusException(
          HttpStatus.CONFLICT,
          "Google Calendar is not set up on this server: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and"
              + " GOOGLE_REDIRECT_URI must be configured first.");
  }

  private static Instant instant(Object value) {
    if (value == null) return null;
    if (value instanceof java.sql.Timestamp t) return t.toInstant();
    if (value instanceof java.time.OffsetDateTime o) return o.toInstant();
    return null;
  }

  private static String encode(String value) {
    return URLEncoder.encode(value, StandardCharsets.UTF_8);
  }
}
