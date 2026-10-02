package com.physiocare.clinic.dto.room;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;

public final class RoomDtos {
  private RoomDtos() {}

  public record RoomRequest(
      @NotBlank String name, @NotBlank String roomType, @Positive long branchId, Boolean active) {}

  public record ActiveRequest(boolean active) {}
}
