package com.physiocare.clinic.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.Set;

public final class AuthDtos {

  private AuthDtos() {}

  public record LoginRequest(@NotBlank @Email String email, @NotBlank String password) {}

  public record CreateUserRequest(
      @NotBlank @Email String email,
      @NotBlank
          @Size(min = 12, max = 72)
          @Pattern(
              regexp = "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^A-Za-z\\d]).+$",
              message = "Password must contain upper, lower, number and special character")
          String password,
      @NotBlank String firstName,
      @NotBlank String lastName,
      @NotBlank String role) {}

  /** What the service hands the controller; the token itself never reaches the response body. */
  public record LoginResult(String token, long expiresIn) {}

  /** The body of a sign-in. The token travels only in the HttpOnly session cookie. */
  public record LoginResponse(long expiresIn) {}

  public record MeResponse(
      Long id,
      String email,
      String firstName,
      String lastName,
      boolean active,
      Set<String> roles,
      Set<String> permissions,
      Long staffId,
      java.util.List<Long> branchIds) {}
}
