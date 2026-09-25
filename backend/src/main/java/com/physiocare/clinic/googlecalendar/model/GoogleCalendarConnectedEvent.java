package com.physiocare.clinic.googlecalendar.model;

/** Raised once a staff member finishes linking Google, so their upcoming bookings catch up. */
public record GoogleCalendarConnectedEvent(long staffId) {}
