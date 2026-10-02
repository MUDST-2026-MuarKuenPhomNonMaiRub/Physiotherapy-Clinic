package com.physiocare.clinic.dto.commission;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;

public final class CommissionCourseActionDtos {
  private CommissionCourseActionDtos() {}

  public record AddMemberRequest(@Positive long patientId, @Positive int visitsFromOwner) {}

  public record RefundRemainingRequest(
      @Positive int visits, @NotBlank String reason, @Positive Long memberPatientId) {}
}
