package com.physiocare.clinic.integration.google.model;

/** An event to take out of a therapist's calendar after its appointment moved to someone else. */
public record CalendarRemoval(long appointmentId, long staffId, int attempts) {}
