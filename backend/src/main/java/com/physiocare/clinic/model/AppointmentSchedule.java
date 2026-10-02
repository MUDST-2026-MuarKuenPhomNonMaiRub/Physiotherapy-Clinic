package com.physiocare.clinic.model;

/** The two facts that decide whether an appointment belongs on a calendar, and whose. */
public record AppointmentSchedule(long providerStaffId, String status) {}
