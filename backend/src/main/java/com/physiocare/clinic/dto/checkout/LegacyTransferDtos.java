package com.physiocare.clinic.dto.checkout;

public final class LegacyTransferDtos {
  private LegacyTransferDtos() {}

  public record Report(int confident, int ambiguous, int mutated) {}
}
