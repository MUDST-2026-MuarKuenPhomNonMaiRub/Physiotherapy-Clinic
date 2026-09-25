package com.physiocare.clinic.googlecalendar.model;

import java.time.OffsetDateTime;

/** The event as it should appear in Google Calendar, independent of the wire format. */
public record CalendarEvent(
    String summary,
    String description,
    String location,
    OffsetDateTime start,
    OffsetDateTime end,
    String timeZone,
    long appointmentId) {}
