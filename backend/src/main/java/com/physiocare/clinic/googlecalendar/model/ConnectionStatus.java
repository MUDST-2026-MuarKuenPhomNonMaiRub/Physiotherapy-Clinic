package com.physiocare.clinic.googlecalendar.model;

/** State of a staff member's link to Google. */
public enum ConnectionStatus {
  ACTIVE,
  /** Google no longer accepts the stored refresh token; the person must connect again. */
  REAUTH_REQUIRED
}
