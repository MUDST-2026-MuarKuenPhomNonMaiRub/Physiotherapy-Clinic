package com.physiocare.clinic.googlecalendar.model;

/**
 * Google's token endpoint reply.
 *
 * @param refreshToken present only on the first exchange after consent
 * @param scope space-separated scopes the person actually granted
 */
public record GoogleTokens(String accessToken, long expiresInSeconds, String refreshToken, String scope) {
  public boolean grants(String requiredScope) {
    return scope != null && java.util.Arrays.asList(scope.split(" ")).contains(requiredScope);
  }
}
