package com.physiocare.clinic.appointment;

import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class AppointmentConflictService {
  private final AppointmentRepository appointments;

  public AppointmentConflictService(AppointmentRepository appointments) {
    this.appointments = appointments;
  }

  public void requireFreeSlot(AppointmentController.AppointmentRequest r, Long excludeId) {
    if (appointments.providerClashes(r.providerStaffId(), excludeId, r.startsAt(), r.endsAt()) > 0) {
      throw new IllegalArgumentException("This physiotherapist already has an appointment at that time");
    }
    if (r.roomId() != null && appointments.roomClashes(r.roomId(), excludeId, r.startsAt(), r.endsAt()) > 0) {
      throw new IllegalArgumentException("This treatment room is unavailable at that time");
    }
  }
}
