package com.physiocare.clinic.dto.auth;

import jakarta.validation.constraints.NotBlank;

public final class UserDtos {
  private UserDtos() {}

  public record UpdateRequest(String role, Boolean active) {}

  public record BranchesRequest(@NotBlank String branchIds) {}
}
