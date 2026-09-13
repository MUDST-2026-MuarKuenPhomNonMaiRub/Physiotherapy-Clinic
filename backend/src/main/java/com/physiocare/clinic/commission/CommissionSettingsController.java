package com.physiocare.clinic.commission;

import jakarta.validation.Valid;
import java.util.Map;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;

/** HTTP adapter for monthly commission tier settings. */
@RestController
@RequestMapping("/api/v1/commission/settings")
public class CommissionSettingsController {
  private final CommissionSettingsService service;
  public CommissionSettingsController(CommissionSettingsService service){this.service=service;}
  @GetMapping public Object list(){return service.list();}
  @PostMapping
  @PreAuthorize("hasRole('ADMIN')")
  public Object create(@Valid @RequestBody CommissionSettingsService.Scheme r, Authentication a){return service.create(r,a);}
}
