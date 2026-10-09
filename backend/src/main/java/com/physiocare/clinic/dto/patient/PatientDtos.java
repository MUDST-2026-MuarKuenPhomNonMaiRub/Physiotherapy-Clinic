package com.physiocare.clinic.dto.patient;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import java.time.LocalDate;

public final class PatientDtos {
  private PatientDtos() {}

  public record PatientRequest(
      @NotBlank String customerType,
      @NotBlank String prefix,
      @NotBlank String firstNameTh,
      @NotBlank String lastNameTh,
      String firstNameEn,
      String lastNameEn,
      String nickname,
      @NotBlank String genderCode,
      String nationalId,
      String passportNo,
      LocalDate birthDate,
      String bloodGroupCode,
      String nationalityCode,
      @NotBlank String phone,
      String email,
      String addressText,
      String customerGroupCode,
      String referralChannelCode,
      String insuranceCompanyCode,
      @Positive long registeredBranchId) {}
}
