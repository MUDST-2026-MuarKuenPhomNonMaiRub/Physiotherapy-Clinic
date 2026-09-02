package com.physiocare.clinic.staff;

import jakarta.validation.constraints.*;

public final class StaffDtos {
  private StaffDtos() {}

  public record CreateRequest(
      @NotBlank String name,
      String nameEn,
      @NotBlank String position,
      String phone,
      @NotBlank @Email String email,
      @NotBlank String branchIds,
      @NotBlank String role,
      @NotBlank @Size(max = 72) String password,
      String avatarColor) {}

  public record CreateResponse(Long staffId, Long userId) {}

  public record Row(
      Long id,
      String name,
      String nameEn,
      String position,
      String phone,
      String email,
      String branchIds,
      String status,
      String avatarColor,
      Long userId,
      String userRole,
      boolean userActive) {}
}
