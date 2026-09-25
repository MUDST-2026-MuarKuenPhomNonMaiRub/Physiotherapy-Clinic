package com.physiocare.clinic.integration.google.model;

/** What Google's token endpoint hands back. The refresh token is only present after consent. */
public record GoogleTokens(String accessToken, String refreshToken, long expiresInSeconds) {}
