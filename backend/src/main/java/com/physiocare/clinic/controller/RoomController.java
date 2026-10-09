package com.physiocare.clinic.controller;

import com.physiocare.clinic.dto.room.RoomDtos.ActiveRequest;
import com.physiocare.clinic.dto.room.RoomDtos.RoomRequest;
import com.physiocare.clinic.service.RoomService;

import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

/** HTTP adapter for rooms and bookable resources. */
@RestController
@RequestMapping("/api/v1/rooms")
public class RoomController {
  private final RoomService service;
  public RoomController(RoomService service) { this.service = service; }
  @GetMapping public List<Map<String,Object>> list(@RequestParam(required=false) Long branchId, Authentication authentication) { return service.list(branchId, authentication); }
  @PostMapping @ResponseStatus(HttpStatus.CREATED)
  @PreAuthorize("@permissionGuard.hasAny(authentication, 'settings.manage')")
  public Map<String,Object> create(@Valid @RequestBody RoomRequest r) { return service.create(r); }
  @PatchMapping("/{id}")
  @PreAuthorize("@permissionGuard.hasAny(authentication, 'settings.manage')")
  public Map<String,Object> update(@PathVariable long id,@Valid @RequestBody RoomRequest r) { return service.update(id,r); }
  @PatchMapping("/{id}/status")
  @PreAuthorize("@permissionGuard.hasAny(authentication, 'settings.manage')")
  public Map<String,Object> setStatus(@PathVariable long id,@RequestBody ActiveRequest r) { return service.setStatus(id,r); }
}
