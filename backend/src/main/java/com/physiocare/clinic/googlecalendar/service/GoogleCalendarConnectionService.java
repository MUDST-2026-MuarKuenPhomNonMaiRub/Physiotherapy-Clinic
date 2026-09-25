package com.physiocare.clinic.googlecalendar.service;

import com.physiocare.clinic.common.CurrentUser;
import com.physiocare.clinic.googlecalendar.client.GoogleApiException;
import com.physiocare.clinic.googlecalendar.client.GoogleOAuthClient;
import com.physiocare.clinic.googlecalendar.config.GoogleCalendarProperties;
import com.physiocare.clinic.googlecalendar.model.GoogleCalendarConnectedEvent;
import com.physiocare.clinic.googlecalendar.model.GoogleCalendarConnection;
import com.physiocare.clinic.googlecalendar.model.GoogleCalendarDtos.ConnectResponse;
import com.physiocare.clinic.googlecalendar.model.GoogleCalendarDtos.ConnectionStatusResponse;
import com.physiocare.clinic.googlecalendar.model.GoogleCalendarDtos.StaffConnectionResponse;
import com.physiocare.clinic.googlecalendar.model.GoogleTokens;
import com.physiocare.clinic.googlecalendar.repository.GoogleCalendarConnectionRepository;
import com.physiocare.clinic.patient.PiiCryptoService;
import java.net.URI;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.util.UriComponentsBuilder;

/**
 * Linking and unlinking a staff member's Google account, and handing out
 * short-lived access tokens to the sync.
 */
@Service
public class GoogleCalendarConnectionService {
  private static final Logger log = LoggerFactory.getLogger(GoogleCalendarConnectionService.class);
  static final String REAUTH_MESSAGE = "Google access has expired. Connect Google Calendar again.";

  private final GoogleCalendarProperties properties;
  private final GoogleCalendarConnectionRepository connections;
  private final GoogleOAuthClient oauth;
  private final OAuthStateService states;
  private final PiiCryptoService crypto;
  private final CurrentUser currentUser;
  private final ApplicationEventPublisher events;
  private final Map<Long, CachedToken> accessTokens = new ConcurrentHashMap<>();

  private record CachedToken(String value, Instant expiresAt) {}

  public GoogleCalendarConnectionService(GoogleCalendarProperties properties,
      GoogleCalendarConnectionRepository connections, GoogleOAuthClient oauth,
      OAuthStateService states, PiiCryptoService crypto, CurrentUser currentUser,
      ApplicationEventPublisher events) {
    this.properties = properties;
    this.connections = connections;
    this.oauth = oauth;
    this.states = states;
    this.crypto = crypto;
    this.currentUser = currentUser;
    this.events = events;
  }

  public ConnectionStatusResponse status(Authentication auth) {
    Long staffId = currentUser.staffId(auth);
    if (staffId == null) {
      return new ConnectionStatusResponse(properties.isConfigured(), false, false, null, null, null, null);
    }
    return connections.findByStaffId(staffId)
        .map(c -> new ConnectionStatusResponse(properties.isConfigured(), true, true,
            c.googleEmail(), c.status().name(), c.connectedAt(), c.lastError()))
        .orElse(new ConnectionStatusResponse(properties.isConfigured(), true, false, null, null, null, null));
  }

  public List<StaffConnectionResponse> listStaffConnections() {
    return connections.listStaffConnections();
  }

  public ConnectResponse startConnect(Authentication auth) {
    requireConfigured();
    Long userId = currentUser.id(auth);
    Long staffId = currentUser.staffId(auth);
    if (userId == null || staffId == null) {
      throw new IllegalArgumentException("Only an account linked to a staff profile can connect Google Calendar");
    }
    return new ConnectResponse(oauth.authorizationUrl(states.issue(staffId, userId)));
  }

  /**
   * Finishes the consent round trip. Never throws: whatever happens, the
   * browser is sent back to the app with a result it can show.
   */
  public URI completeConnect(String code, String state, String error) {
    if (!properties.isConfigured()) return backToApp("error", "not_configured");
    if (error != null) return backToApp("error", "access_denied".equals(error) ? "denied" : "google_error");
    if (code == null || state == null) return backToApp("error", "invalid_request");

    OAuthStateService.State verified;
    try {
      verified = states.verify(state);
    } catch (IllegalArgumentException e) {
      return backToApp("error", "invalid_state");
    }
    if (!connections.staffBelongsToUser(verified.staffId(), verified.userId())) {
      return backToApp("error", "staff_mismatch");
    }

    try {
      GoogleTokens tokens = oauth.exchangeCode(code);
      if (!tokens.grants(GoogleOAuthClient.CALENDAR_EVENTS_SCOPE)) return backToApp("error", "missing_scope");
      if (tokens.refreshToken() == null) return backToApp("error", "no_refresh_token");
      String email = oauth.fetchEmail(tokens.accessToken());
      connections.upsert(verified.staffId(), email, crypto.encrypt(tokens.refreshToken()), verified.userId());
      cache(verified.staffId(), tokens);
    } catch (GoogleApiException e) {
      log.warn("Google Calendar connection failed for staff {}: {}", verified.staffId(), e.getMessage());
      return backToApp("error", "google_error");
    }
    events.publishEvent(new GoogleCalendarConnectedEvent(verified.staffId()));
    return backToApp("connected", null);
  }

  public void disconnectSelf(Authentication auth) {
    Long staffId = currentUser.staffId(auth);
    if (staffId == null) throw new IllegalArgumentException("This account has no staff profile");
    disconnect(staffId);
  }

  /**
   * Revokes the grant at Google (best effort — the person may already have
   * removed it there) and forgets the token. Events already in the calendar
   * stay; the clinic simply stops updating them.
   */
  public void disconnect(long staffId) {
    Optional<GoogleCalendarConnection> connection = connections.findByStaffId(staffId);
    if (connection.isEmpty()) return;
    try {
      oauth.revoke(crypto.decrypt(connection.get().refreshTokenCiphertext()));
    } catch (RuntimeException e) {
      log.info("Google token revoke for staff {} did not succeed: {}", staffId, e.getMessage());
    }
    connections.deleteByStaffId(staffId);
    accessTokens.remove(staffId);
  }

  public Optional<GoogleCalendarConnection> findConnection(long staffId) {
    return connections.findByStaffId(staffId);
  }

  /**
   * A valid access token for the connection, refreshed when it is within a
   * minute of expiring. A refused refresh flags the connection so the person
   * is asked to connect again, and is rethrown for the caller to record.
   */
  public String accessTokenFor(GoogleCalendarConnection connection) {
    CachedToken cached = accessTokens.get(connection.staffId());
    if (cached != null && cached.expiresAt().isAfter(Instant.now().plusSeconds(60))) {
      return cached.value();
    }
    try {
      GoogleTokens tokens = oauth.refresh(crypto.decrypt(connection.refreshTokenCiphertext()));
      cache(connection.staffId(), tokens);
      return tokens.accessToken();
    } catch (GoogleApiException e) {
      if (e.isAuthFailure()) markReauthRequired(connection.staffId());
      throw e;
    }
  }

  /** Called when Google rejects a token mid-sync (for example after the person removed access). */
  public void markReauthRequired(long staffId) {
    accessTokens.remove(staffId);
    connections.markReauthRequired(staffId, REAUTH_MESSAGE);
  }

  private void cache(long staffId, GoogleTokens tokens) {
    accessTokens.put(staffId,
        new CachedToken(tokens.accessToken(), Instant.now().plusSeconds(tokens.expiresInSeconds())));
  }

  private void requireConfigured() {
    if (!properties.isConfigured()) {
      throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
          "Google Calendar sync is not configured on this server");
    }
  }

  private URI backToApp(String status, String reason) {
    UriComponentsBuilder uri = UriComponentsBuilder.fromUriString(properties.frontendUrl())
        .path("/google-calendar")
        .queryParam("status", status);
    if (reason != null) uri.queryParam("reason", reason);
    return uri.build().toUri();
  }
}
