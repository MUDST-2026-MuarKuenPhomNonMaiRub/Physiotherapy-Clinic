package com.physiocare.clinic.staff;

import jakarta.validation.constraints.*;

public final class StaffDtos {
  private StaffDtos() {}

  public record CreateRequest(
      @NotBlank String name,
      String nameEn,
      @NotBlank String position,
      String phone,
      @Email String email,
      @NotBlank String branchIds,
      String role,
      String password,
      String avatarColor,
      /** Salespeople may be created as commission-only records without a login. */
      Boolean hasAccount) {}

  public record UpdateRequest(
      @NotBlank String name,
      String nameEn,
      @NotBlank String position,
      String phone,
      @NotBlank String branchIds,
      String status,
      String avatarColor,
      Boolean commissionEligible,
      java.time.LocalDate terminationDate,
      String commissionAfterTerminationPolicy) {}

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
      boolean userActive,
      boolean commissionEligible,
      java.time.LocalDate terminationDate,
      String commissionAfterTerminationPolicy) {}
}
