package com.physiocare.clinic.integration.google;

import java.util.Map;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestClient;

/**
 * The few Google endpoints this integration talks to, behind one class so the
 * sync logic can be tested against a stand-in. Every call here is outbound
 * only: the clinic never reads a calendar back.
 */
@Component
public class GoogleApiClient {
  static final String TOKEN_URL = "https://oauth2.googleapis.com/token";
  static final String REVOKE_URL = "https://oauth2.googleapis.com/revoke";
  static final String USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";
  static final String CALENDAR_URL = "https://www.googleapis.com/calendar/v3/calendars";

  /** Thrown for any answer Google gives other than success; the status decides whether a retry can help. */
  public static class GoogleApiException extends RuntimeException {
    private final int status;

    public GoogleApiException(int status, String message) {
      super(message);
      this.status = status;
    }

    public int status() {
      return status;
    }

    /** 4xx other than 429 is a request Google will never accept — retrying it is pointless. */
    public boolean permanent() {
      return status >= 400 && status < 500 && status != 429;
    }

    /** The account withdrew access (or the token was revoked): the connection is dead. */
    public boolean unauthorised() {
      return status == 401 || status == 403;
    }
  }

  public record Tokens(String accessToken, String refreshToken, long expiresInSeconds) {}

  private final RestClient http;
  private final GoogleSettings settings;

  @Autowired
  public GoogleApiClient(GoogleSettings settings) {
    this(settings, RestClient.builder().build());
  }

  GoogleApiClient(GoogleSettings settings, RestClient http) {
    this.settings = settings;
    this.http = http;
  }

  /** Swaps the one-time code Google sent back for a refresh token (and a first access token). */
  public Tokens exchangeCode(String code) {
    MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
    form.add("code", code);
    form.add("client_id", settings.clientId());
    form.add("client_secret", settings.clientSecret());
    form.add("redirect_uri", settings.redirectUri());
    form.add("grant_type", "authorization_code");
    Map<?, ?> body = postForm(TOKEN_URL, form);
    return new Tokens(
        String.valueOf(body.get("access_token")),
        body.get("refresh_token") == null ? null : String.valueOf(body.get("refresh_token")),
        body.get("expires_in") == null ? 3600 : ((Number) body.get("expires_in")).longValue());
  }

  /** A fresh short-lived access token from the stored refresh token. */
  public Tokens refresh(String refreshToken) {
    MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
    form.add("refresh_token", refreshToken);
    form.add("client_id", settings.clientId());
    form.add("client_secret", settings.clientSecret());
    form.add("grant_type", "refresh_token");
    Map<?, ?> body = postForm(TOKEN_URL, form);
    return new Tokens(
        String.valueOf(body.get("access_token")),
        refreshToken,
        body.get("expires_in") == null ? 3600 : ((Number) body.get("expires_in")).longValue());
  }

  /** Tells Google to forget the grant. Best effort: a failure here must not stop a disconnect. */
  public void revoke(String refreshToken) {
    try {
      http.post()
          .uri(REVOKE_URL + "?token={token}", refreshToken)
          .contentType(MediaType.APPLICATION_FORM_URLENCODED)
          .retrieve()
          .toBodilessEntity();
    } catch (RuntimeException ignored) {
      // Already revoked, or Google unreachable — the stored token is dropped either way.
    }
  }

  /** The address of the Google account that granted access, shown so the person can see which one is linked. */
  public String email(String accessToken) {
    try {
      Map<?, ?> body =
          http.get()
              .uri(USERINFO_URL)
              .header("Authorization", "Bearer " + accessToken)
              .retrieve()
              .body(Map.class);
      return body == null || body.get("email") == null ? null : String.valueOf(body.get("email"));
    } catch (HttpStatusCodeException e) {
      throw translate(e);
    }
  }

  /**
   * Creates the event under the id the clinic chose. Google answers 409 when
   * that id already exists (a retry after a lost response), and the caller
   * then updates instead.
   */
  public void insertEvent(String accessToken, String calendarId, Map<String, Object> event) {
    try {
      http.post()
          .uri(CALENDAR_URL + "/{calendar}/events", calendarId)
          .header("Authorization", "Bearer " + accessToken)
          .contentType(MediaType.APPLICATION_JSON)
          .body(event)
          .retrieve()
          .toBodilessEntity();
    } catch (HttpStatusCodeException e) {
      throw translate(e);
    }
  }

  public void updateEvent(String accessToken, String calendarId, String eventId, Map<String, Object> event) {
    try {
      http.put()
          .uri(CALENDAR_URL + "/{calendar}/events/{event}", calendarId, eventId)
          .header("Authorization", "Bearer " + accessToken)
          .contentType(MediaType.APPLICATION_JSON)
          .body(event)
          .retrieve()
          .toBodilessEntity();
    } catch (HttpStatusCodeException e) {
      throw translate(e);
    }
  }

  /** Removes the event; one that is already gone (404/410) counts as removed. */
  public void deleteEvent(String accessToken, String calendarId, String eventId) {
    try {
      http.delete()
          .uri(CALENDAR_URL + "/{calendar}/events/{event}", calendarId, eventId)
          .header("Authorization", "Bearer " + accessToken)
          .retrieve()
          .toBodilessEntity();
    } catch (HttpStatusCodeException e) {
      HttpStatusCode status = e.getStatusCode();
      if (status.value() == 404 || status.value() == 410) return;
      throw translate(e);
    }
  }

  private Map<?, ?> postForm(String url, MultiValueMap<String, String> form) {
    try {
      Map<?, ?> body =
          http.post()
              .uri(url)
              .contentType(MediaType.APPLICATION_FORM_URLENCODED)
              .body(form)
              .retrieve()
              .body(Map.class);
      if (body == null || body.get("access_token") == null)
        throw new GoogleApiException(HttpStatus.BAD_GATEWAY.value(), "Google returned no access token");
      return body;
    } catch (HttpStatusCodeException e) {
      throw translate(e);
    }
  }

  private static GoogleApiException translate(HttpStatusCodeException e) {
    String detail = e.getResponseBodyAsString();
    return new GoogleApiException(
        e.getStatusCode().value(),
        "Google answered " + e.getStatusCode().value()
            + (detail == null || detail.isBlank() ? "" : ": " + abbreviate(detail)));
  }

  private static String abbreviate(String value) {
    return value.length() <= 300 ? value : value.substring(0, 300) + "…";
  }
}
