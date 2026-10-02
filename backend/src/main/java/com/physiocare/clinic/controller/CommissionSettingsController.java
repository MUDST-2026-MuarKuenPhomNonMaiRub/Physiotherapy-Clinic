package com.physiocare.clinic.controller;

import com.physiocare.clinic.dto.commission.CommissionSettingsDtos.Scheme;
import com.physiocare.clinic.service.CommissionSettingsService;

import jakarta.validation.Valid;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;

/** HTTP adapter for monthly commission tier settings. */
@RestController
@RequestMapping("/api/v1/commission/settings")
public class CommissionSettingsController {
  private final CommissionSettingsService service;
  public CommissionSettingsController(CommissionSettingsService service){this.service=service;}
  @GetMapping
  @PreAuthorize("@permissionGuard.hasAny(authentication, 'settings.manage')")
  public Object list(){return service.list();}
  @PostMapping
  @PreAuthorize("@permissionGuard.hasAny(authentication, 'settings.manage')")
  public Object create(@Valid @RequestBody Scheme r, Authentication a){return service.create(r,a);}
}
