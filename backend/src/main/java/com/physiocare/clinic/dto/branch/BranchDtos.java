package com.physiocare.clinic.dto.branch;

public final class BranchDtos {
  private BranchDtos() {}

  public record StatusRequest(boolean active) {}
}
