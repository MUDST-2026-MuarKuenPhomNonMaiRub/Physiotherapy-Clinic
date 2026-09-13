package com.physiocare.clinic.patient;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

/** HTTP adapter for patient registration and lookup. */
@RestController
@RequestMapping("/api/v1/patients")
public class PatientController {
  private final PatientService service;

  public PatientController(PatientService service) { this.service = service; }

  public record PatientRequest(@NotBlank String customerType, @NotBlank String prefix,
      @NotBlank String firstNameTh, @NotBlank String lastNameTh, String firstNameEn,
      String lastNameEn, String nickname, @NotBlank String genderCode, String nationalId,
      String passportNo, LocalDate birthDate, String bloodGroupCode, String nationalityCode,
      @NotBlank String phone, String email, String addressText, String customerGroupCode,
      String referralChannelCode, String insuranceCompanyCode, @Positive long registeredBranchId) {}

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public Map<String, Object> create(@Valid @RequestBody PatientRequest r, Authentication authentication) {
    return service.create(toPatient(r), authentication);
  }

  @GetMapping
  public List<Map<String, Object>> list(@RequestParam(defaultValue = "") String search,
      @RequestParam(required = false) Long branchId, Authentication authentication) {
    return service.list(search, branchId, authentication);
  }

  @GetMapping("/{id}")
  public Map<String, Object> get(@PathVariable long id, Authentication authentication) {
    return service.get(id, authentication);
  }

  @PatchMapping("/{id}")
  public Map<String, Object> update(@PathVariable long id, @Valid @RequestBody PatientRequest r,
      Authentication authentication) { return service.update(id, toPatient(r), authentication); }

  @GetMapping("/hn-preview")
  public Map<String, Object> hnPreview(@RequestParam long branchId, Authentication authentication) {
    return service.hnPreview(branchId, authentication);
  }

  private static PatientService.PatientRequest toPatient(PatientRequest r) {
    return new PatientService.PatientRequest(r.customerType(), r.prefix(), r.firstNameTh(), r.lastNameTh(),
        r.firstNameEn(), r.lastNameEn(), r.nickname(), r.genderCode(), r.nationalId(), r.passportNo(),
        r.birthDate(), r.bloodGroupCode(), r.nationalityCode(), r.phone(), r.email(), r.addressText(),
        r.customerGroupCode(), r.referralChannelCode(), r.insuranceCompanyCode(), r.registeredBranchId());
  }
}
