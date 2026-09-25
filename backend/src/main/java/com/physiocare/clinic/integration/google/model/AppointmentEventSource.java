package com.physiocare.clinic.integration.google.model;

import java.time.Instant;

/**
 * Everything an event is built from. Patient details stop at the HN and
 * nickname on purpose: the event lives in the therapist's personal Google
 * account, so the full name and phone number are never read here.
 */
public record AppointmentEventSource(
    long appointmentId,
    String status,
    Instant startsAt,
    Instant endsAt,
    String appointmentNo,
    String hn,
    String nickname,
    String serviceName,
    String roomName,
    String branchName,
    String branchAddress,
    String timezone) {}
