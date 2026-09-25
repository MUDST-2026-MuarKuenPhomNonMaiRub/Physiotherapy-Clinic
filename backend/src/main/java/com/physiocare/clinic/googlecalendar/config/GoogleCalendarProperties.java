package com.physiocare.clinic.googlecalendar.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Settings for the Google Calendar sync, bound from {@code app.google-calendar.*}
 * (see application.properties for the environment variables behind them).
 *
 * @param redirectUri where Google sends the browser back after consent; must
 *     match an "Authorized redirect URI" on the OAuth client exactly
 * @param frontendUrl the clinic web app, where the callback finally lands
 * @param maxAttempts how many times the retry job tries one appointment
 *     before leaving it for a manual retry
 */
@ConfigurationProperties(prefix = "app.google-calendar")
public record GoogleCalendarProperties(
    @DefaultValue("false") boolean enabled,
    @DefaultValue("") String clientId,
    @DefaultValue("") String clientSecret,
    @DefaultValue("http://localhost:8080/api/v1/integrations/google-calendar/callback")
        String redirectUri,
    @DefaultValue("http://localhost:3000") String frontendUrl,
    @DefaultValue("10") int maxAttempts) {

  /** Off unless switched on and given an OAuth client, so a fresh clone runs without Google. */
  public boolean isConfigured() {
    return enabled && !clientId.isBlank() && !clientSecret.isBlank();
  }
}
