package com.physiocare.clinic.dto.checkout;

import jakarta.validation.constraints.Positive;

public final class CourseTransferDtos {
  private CourseTransferDtos() {}

  public record TransferRequest(
      @Positive long patientCourseId,
      @Positive long toPatientId,
      @Positive int sessions,
      String reason) {}
}
