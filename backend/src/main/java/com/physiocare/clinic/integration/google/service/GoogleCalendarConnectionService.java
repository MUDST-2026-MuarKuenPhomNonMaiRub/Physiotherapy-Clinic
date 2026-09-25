package com.physiocare.clinic.integration.google.service;

import com.physiocare.clinic.common.AuditService;
import com.physiocare.clinic.integration.google.client.GoogleApiClient;
import com.physiocare.clinic.integration.google.config.GoogleSettings;
import com.physiocare.clinic.integration.google.model.CalendarConnection;
import com.physiocare.clinic.integration.google.model.ConnectionStatus;
import com.physiocare.clinic.integration.google.model.GoogleCalendarDtos.ConnectionRow;
import com.physiocare.clinic.integration.google.model.GoogleTokens;
import com.physiocare.clinic.integration.google.model.OAuthState;
import com.physiocare.clinic.integration.google.repository.GoogleConnectionRepository;
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

  private record CachedToken(String accessToken, Instant expiresAt) {}

  private final GoogleConnectionRepository connections;
  private final GoogleSettings settings;
  private final GoogleApiClient google;
  private final PiiCryptoService crypto;
  private final AuditService audit;
  private final SecureRandom random = new SecureRandom();
  private final Map<Long, CachedToken> accessTokens = new ConcurrentHashMap<>();

  public GoogleCalendarConnectionService(
      GoogleConnectionRepository connections,
      GoogleSettings settings,
      GoogleApiClient google,
      PiiCryptoService crypto,
      AuditService audit) {
    this.connections = connections;
    this.settings = settings;
    this.google = google;
    this.crypto = crypto;
    this.audit = audit;
  }

  public ConnectionStatus status(long staffId) {
    return connections.findStatusRow(staffId)
        .map(row -> new ConnectionStatus(
            settings.configured(),
            true,
            (String) row.get("google_email"),
            instant(row.get("connected_at")),
            (String) row.get("last_error"),
            instant(row.get("last_error_at"))))
        .orElse(new ConnectionStatus(settings.configured(), false, null, null, null, null));
  }

  public List<ConnectionRow> listConnections() {
    return connections.listConnections();
  }

  /** The Google consent page for this staff member, with a one-time state tying the answer back to them. */
  @Transactional
  public String authorizationUrl(long staffId, long userId) {
    requireConfigured();
    byte[] bytes = new byte[32];
    random.nextBytes(bytes);
    String state = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    connections.saveState(state, staffId, userId);
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
    OAuthState started = connections.consumeState(state, STATE_TTL_SECONDS)
        .orElseThrow(() -> new IllegalArgumentException(
            "This Google sign-in link has expired. Start the connection again."));

    GoogleTokens tokens = google.exchangeCode(code);
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

    connections.upsert(started.staffId(), email, crypto.encrypt(tokens.refreshToken()), started.userId());
    cache(started.staffId(), tokens);
    audit.record(started.userId(), null, "GOOGLE_CALENDAR_CONNECTED", "staff", String.valueOf(started.staffId()),
        null, Map.of("googleEmail", email == null ? "" : email), "Google Calendar connected");
    return started.staffId();
  }

  /** Drops the stored grant. The caller removes the events first while the token still works. */
  @Transactional
  public void disconnect(long staffId, Long actorUserId, String reason) {
    Optional<CalendarConnection> connection = connection(staffId);
    if (connection.isEmpty()) return;
    google.revoke(connection.get().refreshToken());
    connections.delete(staffId);
    accessTokens.remove(staffId);
    audit.record(actorUserId, null, "GOOGLE_CALENDAR_DISCONNECTED", "staff", String.valueOf(staffId),
        null, null, reason);
  }

  public Optional<CalendarConnection> connection(long staffId) {
    return connections.find(staffId)
        .map(stored -> new CalendarConnection(
            staffId, stored.calendarId(), crypto.decrypt(stored.refreshTokenCiphertext())));
  }

  public boolean isConnected(long staffId) {
    return connections.exists(staffId);
  }

  /** A usable access token, refreshed from the stored grant when the cached one is about to lapse. */
  public String accessToken(CalendarConnection connection) {
    CachedToken cached = accessTokens.get(connection.staffId());
    if (cached != null && cached.expiresAt().isAfter(Instant.now())) return cached.accessToken();
    GoogleTokens tokens = google.refresh(connection.refreshToken());
    cache(connection.staffId(), tokens);
    return tokens.accessToken();
  }

  public void forgetAccessToken(long staffId) {
    accessTokens.remove(staffId);
  }

  public void recordError(long staffId, String message) {
    connections.recordError(staffId, message);
  }

  public void clearError(long staffId) {
    connections.clearError(staffId);
  }

  public String frontendUrl() {
    return settings.frontendUrl();
  }

  private void cache(long staffId, GoogleTokens tokens) {
    accessTokens.put(
        staffId, new CachedToken(tokens.accessToken(), Instant.now().plusSeconds(tokens.expiresInSeconds() - 60)));
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
