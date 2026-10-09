package com.physiocare.clinic.dto.auth;

import java.util.List;

public final class RoleDtos {
  private RoleDtos() {}

  public record RoleRequest(String code, String name, List<String> permissionCodes) {}
}
