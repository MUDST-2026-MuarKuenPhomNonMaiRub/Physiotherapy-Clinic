package com.physiocare.clinic.dto.appointment;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.time.OffsetDateTime;

public final class AppointmentDtos {
  private AppointmentDtos() {}

  public record AppointmentRequest(
      @Positive long patientId,
      @Positive long branchId,
      @Positive long providerStaffId,
      @Positive long serviceId,
      Long roomId,
      @NotNull OffsetDateTime startsAt,
      @NotNull OffsetDateTime endsAt,
      String patientNote,
      String internalNote) {}

  public record RescheduleRequest(
      @NotNull OffsetDateTime startsAt, @NotNull OffsetDateTime endsAt, String reason) {}

  public record TimeChangeRequest(
      @NotNull OffsetDateTime startsAt, @NotNull OffsetDateTime endsAt, Long providerStaffId) {
    public TimeChangeRequest(OffsetDateTime startsAt, OffsetDateTime endsAt) {
      this(startsAt, endsAt, null);
    }
  }

  public record ReasonRequest(String reason, Long usePatientCourseId) {}
}
