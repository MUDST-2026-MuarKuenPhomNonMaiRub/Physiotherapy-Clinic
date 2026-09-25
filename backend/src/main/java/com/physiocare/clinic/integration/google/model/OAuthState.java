package com.physiocare.clinic.integration.google.model;

/** Who started a consent round trip, recovered from the one-time state Google hands back. */
public record OAuthState(long staffId, long userId) {}
