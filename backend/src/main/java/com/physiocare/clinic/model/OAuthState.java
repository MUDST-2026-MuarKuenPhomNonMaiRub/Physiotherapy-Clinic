package com.physiocare.clinic.model;

/** Who started a consent round trip, recovered from the one-time state Google hands back. */
public record OAuthState(long staffId, long userId) {}
