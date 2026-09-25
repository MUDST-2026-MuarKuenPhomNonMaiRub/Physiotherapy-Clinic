package com.physiocare.clinic.integration.google.model;

import java.time.Instant;

/**
 * One staff member's link as the screens see it.
 *
 * @param configured false when the server has no Google client, so the feature is off
 */
public record ConnectionStatus(
    boolean configured,
    boolean connected,
    String googleEmail,
    Instant connectedAt,
    String lastError,
    Instant lastErrorAt) {}
