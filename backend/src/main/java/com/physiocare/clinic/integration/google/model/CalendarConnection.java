package com.physiocare.clinic.integration.google.model;

/** A staff member's usable link to Google: which calendar, and the decrypted refresh token. */
public record CalendarConnection(long staffId, String calendarId, String refreshToken) {}
