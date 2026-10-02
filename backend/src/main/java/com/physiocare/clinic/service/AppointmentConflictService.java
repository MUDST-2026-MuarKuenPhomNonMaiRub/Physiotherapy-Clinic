package com.physiocare.clinic.service;

import com.physiocare.clinic.dto.appointment.AppointmentDtos.AppointmentRequest;
import com.physiocare.clinic.repository.AppointmentRepository;

import org.springframework.stereotype.Service;

@Service
public class AppointmentConflictService {
  private final AppointmentRepository appointments;

  public AppointmentConflictService(AppointmentRepository appointments) {
    this.appointments = appointments;
  }

  public void requireFreeSlot(AppointmentRequest r, Long excludeId) {
    if (appointments.providerClashes(r.providerStaffId(), excludeId, r.startsAt(), r.endsAt()) > 0) {
      throw new IllegalArgumentException("This physiotherapist already has an appointment at that time");
    }
    if (r.roomId() != null && appointments.roomClashes(r.roomId(), excludeId, r.startsAt(), r.endsAt()) > 0) {
      throw new IllegalArgumentException("This treatment room is unavailable at that time");
    }
  }
}
