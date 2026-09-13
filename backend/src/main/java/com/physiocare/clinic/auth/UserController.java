package com.physiocare.clinic.auth;

import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

/** HTTP adapter for account administration. */
@RestController
@RequestMapping("/api/v1/users")
@PreAuthorize("@permissionGuard.hasAny(authentication, 'settings.manage')")
public class UserController {
  private final UserService service;
  public UserController(UserService service) { this.service = service; }
  @GetMapping public List<Map<String,Object>> list() { return service.list(); }
  @PatchMapping("/{id}")
  public Map<String,Object> update(@PathVariable long id,@RequestBody UserService.UpdateRequest r,Authentication a) { return service.update(id,r,a); }
  @PutMapping("/{id}/branches")
  public Map<String,Object> setBranches(@PathVariable long id,@Valid @RequestBody UserService.BranchesRequest r) { return service.setBranches(id,r); }
  @DeleteMapping("/{id}")
  public void softDelete(@PathVariable long id,Authentication a) { service.softDelete(id,a); }
}
