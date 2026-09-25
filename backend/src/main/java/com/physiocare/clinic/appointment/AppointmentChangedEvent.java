package com.physiocare.clinic.appointment;

/**
 * Published inside the booking transaction whenever an appointment is created,
 * moved or changes status. Integrations such as the Google Calendar sync listen
 * for it, so this module never has to know they exist.
 *
 * @param appointmentId the appointment as it stands after the change — for a
 *     reschedule, the new booking
 * @param previousAppointmentId the booking a reschedule replaced, otherwise null
 */
public record AppointmentChangedEvent(Type type, long appointmentId, Long previousAppointmentId) {
  public enum Type { CREATED, RESCHEDULED, STATUS_CHANGED }

  public static AppointmentChangedEvent created(long id) {
    return new AppointmentChangedEvent(Type.CREATED, id, null);
  }

  public static AppointmentChangedEvent rescheduled(long previousId, long newId) {
    return new AppointmentChangedEvent(Type.RESCHEDULED, newId, previousId);
  }

  public static AppointmentChangedEvent statusChanged(long id) {
    return new AppointmentChangedEvent(Type.STATUS_CHANGED, id, null);
  }
}
