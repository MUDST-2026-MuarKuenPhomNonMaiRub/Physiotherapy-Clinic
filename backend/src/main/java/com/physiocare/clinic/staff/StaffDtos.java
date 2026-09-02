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
      // A staff record always carries a login, so it is held to the same
      // password policy as an account created directly.
      @NotBlank
          @Size(min = 12, max = 72)
          @Pattern(
              regexp = "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^A-Za-z\\d]).+$",
              message = "Password must contain upper, lower, number and special character")
          String password,
      String avatarColor) {}

  public record UpdateRequest(
      @NotBlank String name,
      String nameEn,
      @NotBlank String position,
      String phone,
      @NotBlank String branchIds,
      String status,
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
