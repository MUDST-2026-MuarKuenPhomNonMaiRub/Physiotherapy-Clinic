package com.physiocare.clinic.integration.google.model;

/**
 * What Google's token endpoint answered. The refresh token is only present
 * after consent; {@code scope} is the space-separated
 * list of permissions the person actually granted — on Google's consent page
 * each one is a checkbox that can be left unticked — or null when Google did
 * not say.
 */
public record GoogleTokens(String accessToken, String refreshToken, long expiresInSeconds, String scope) {
  public GoogleTokens(String accessToken, String refreshToken, long expiresInSeconds) {
    this(accessToken, refreshToken, expiresInSeconds, null);
  }

  /** True unless Google listed the granted scopes and this one is not among them. */
  public boolean grants(String wanted) {
    return scope == null || java.util.Arrays.asList(scope.trim().split("\\s+")).contains(wanted);
  }
}
