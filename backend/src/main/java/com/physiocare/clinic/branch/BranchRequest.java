package com.physiocare.clinic.branch;
import jakarta.validation.constraints.NotBlank; import jakarta.validation.constraints.Size;
public record BranchRequest(@NotBlank @Size(max=10) String code,@NotBlank String name,@NotBlank String phone,@NotBlank String address,boolean active) {}
