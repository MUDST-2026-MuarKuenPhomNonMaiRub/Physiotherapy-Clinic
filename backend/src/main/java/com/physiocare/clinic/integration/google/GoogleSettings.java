package com.physiocare.clinic.integration.google;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/** The OAuth client the clinic registered with Google, or nothing — in which case the feature is off. */
@Component
public class GoogleSettings {
  private final String clientId;
  private final String clientSecret;
  private final String redirectUri;
  private final String frontendUrl;

  public GoogleSettings(
      @Value("${app.google.client-id:}") String clientId,
      @Value("${app.google.client-secret:}") String clientSecret,
      @Value("${app.google.redirect-uri:}") String redirectUri,
      @Value("${app.frontend-url:http://localhost:3000}") String frontendUrl) {
    this.clientId = clientId == null ? "" : clientId.trim();
    this.clientSecret = clientSecret == null ? "" : clientSecret.trim();
    this.redirectUri = redirectUri == null ? "" : redirectUri.trim();
    this.frontendUrl = stripTrailingSlash(frontendUrl == null ? "" : frontendUrl.trim());
  }

  public boolean configured() {
    return !clientId.isBlank() && !clientSecret.isBlank() && !redirectUri.isBlank();
  }

  public String clientId() {
    return clientId;
  }

  public String clientSecret() {
    return clientSecret;
  }

  public String redirectUri() {
    return redirectUri;
  }

  public String frontendUrl() {
    return frontendUrl;
  }

  private static String stripTrailingSlash(String value) {
    return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
  }
}
