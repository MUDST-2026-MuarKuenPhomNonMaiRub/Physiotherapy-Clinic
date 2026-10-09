package com.physiocare.clinic.controller;

import com.physiocare.clinic.dto.auth.RoleDtos.RoleRequest;
import com.physiocare.clinic.service.RolePermissionService;

import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/roles")
@PreAuthorize("@permissionGuard.hasAny(authentication, 'settings.manage')")
public class RoleController {
  private final RolePermissionService roles;

  public RoleController(RolePermissionService roles) {
    this.roles = roles;
  }

  @GetMapping
  public List<Map<String, Object>> list() {
    return roles.list();
  }

  @GetMapping("/permissions")
  public List<Map<String, Object>> permissions() {
    return roles.permissions();
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public Map<String, Object> create(@RequestBody RoleRequest request) {
    return roles.create(request.code(), request.name(), request.permissionCodes());
  }

  @PutMapping("/{id}")
  public Map<String, Object> update(@PathVariable Long id, @RequestBody RoleRequest request) {
    return roles.update(id, request.name(), request.permissionCodes());
  }

  @DeleteMapping("/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void delete(@PathVariable Long id) {
    roles.delete(id);
  }
}
