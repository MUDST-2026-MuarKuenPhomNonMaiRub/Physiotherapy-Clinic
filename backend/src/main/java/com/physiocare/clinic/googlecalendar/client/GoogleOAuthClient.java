package com.physiocare.clinic.googlecalendar.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.physiocare.clinic.googlecalendar.config.GoogleCalendarProperties;
import com.physiocare.clinic.googlecalendar.model.GoogleTokens;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;

/** Google's OAuth 2.0 endpoints: consent URL, code exchange, refresh, revoke. */
@Component
public class GoogleOAuthClient {
  public static final String CALENDAR_EVENTS_SCOPE = "https://www.googleapis.com/auth/calendar.events";
  private static final String SCOPES = "openid email " + CALENDAR_EVENTS_SCOPE;
  private static final String AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
  private static final String TOKEN_URL = "https://oauth2.googleapis.com/token";
  private static final String REVOKE_URL = "https://oauth2.googleapis.com/revoke";
  private static final String USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";

  private final RestClient http;
  private final GoogleCalendarProperties properties;
  private final GoogleErrorDecoder errors = new GoogleErrorDecoder();

  public GoogleOAuthClient(RestClient googleRestClient, GoogleCalendarProperties properties) {
    this.http = googleRestClient;
    this.properties = properties;
  }

  /**
   * {@code access_type=offline} with {@code prompt=consent} makes Google issue a
   * refresh token every time, including when the person linked before.
   */
  public String authorizationUrl(String state) {
    return UriComponentsBuilder.fromUriString(AUTHORIZE_URL)
        .queryParam("client_id", properties.clientId())
        .queryParam("redirect_uri", properties.redirectUri())
        .queryParam("response_type", "code")
        .queryParam("scope", SCOPES)
        .queryParam("access_type", "offline")
        .queryParam("prompt", "consent")
        .queryParam("include_granted_scopes", "true")
        .queryParam("state", state)
        .encode()
        .toUriString();
  }

  public GoogleTokens exchangeCode(String code) {
    MultiValueMap<String, String> form = clientForm();
    form.add("grant_type", "authorization_code");
    form.add("code", code);
    form.add("redirect_uri", properties.redirectUri());
    return postTokenRequest(form);
  }

  public GoogleTokens refresh(String refreshToken) {
    MultiValueMap<String, String> form = clientForm();
    form.add("grant_type", "refresh_token");
    form.add("refresh_token", refreshToken);
    return postTokenRequest(form);
  }

  /** The Google account the token belongs to, shown so people know which calendar is linked. */
  public String fetchEmail(String accessToken) {
    JsonNode user = http.get()
        .uri(USERINFO_URL)
        .headers(h -> h.setBearerAuth(accessToken))
        .retrieve()
        .onStatus(HttpStatusCode::isError, errors)
        .body(JsonNode.class);
    return user == null ? null : user.path("email").asText(null);
  }

  public void revoke(String token) {
    MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
    form.add("token", token);
    http.post()
        .uri(REVOKE_URL)
        .contentType(MediaType.APPLICATION_FORM_URLENCODED)
        .body(form)
        .retrieve()
        .onStatus(HttpStatusCode::isError, errors)
        .toBodilessEntity();
  }

  private MultiValueMap<String, String> clientForm() {
    MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
    form.add("client_id", properties.clientId());
    form.add("client_secret", properties.clientSecret());
    return form;
  }

  private GoogleTokens postTokenRequest(MultiValueMap<String, String> form) {
    JsonNode reply = http.post()
        .uri(TOKEN_URL)
        .contentType(MediaType.APPLICATION_FORM_URLENCODED)
        .body(form)
        .retrieve()
        .onStatus(HttpStatusCode::isError, errors)
        .body(JsonNode.class);
    if (reply == null || !reply.hasNonNull("access_token")) {
      throw new GoogleApiException(502, null, "Google returned no access token");
    }
    return new GoogleTokens(
        reply.get("access_token").asText(),
        reply.path("expires_in").asLong(3600),
        reply.path("refresh_token").asText(null),
        reply.path("scope").asText(null));
  }
}
