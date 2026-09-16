package com.physiocare.clinic.commission;

import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

/** HTTP adapter for substitute treatment-fee rules. */
@RestController
@RequestMapping("/api/v1/treatment-fee-rules")
public class TreatmentFeeRuleController {
  private final TreatmentFeeRuleService service;
  public TreatmentFeeRuleController(TreatmentFeeRuleService service) { this.service = service; }
  @GetMapping public List<Map<String,Object>> list() { return service.list(); }
  @PostMapping @ResponseStatus(HttpStatus.CREATED)
  @PreAuthorize("@permissionGuard.hasAny(authentication, 'settings.manage')")
  public Map<String,Object> create(@Valid @RequestBody TreatmentFeeRuleService.RuleRequest r, Authentication a) { return service.create(r,a); }
  @PatchMapping("/{id}")
  @PreAuthorize("@permissionGuard.hasAny(authentication, 'settings.manage')")
  public Map<String,Object> update(@PathVariable long id,@Valid @RequestBody TreatmentFeeRuleService.RuleRequest r,Authentication a) { return service.update(id,r,a); }
  @PatchMapping("/{id}/status")
  @PreAuthorize("@permissionGuard.hasAny(authentication, 'settings.manage')")
  public Map<String,Object> setStatus(@PathVariable long id,@RequestBody Map<String,Boolean> body,Authentication a) { return service.setStatus(id,body,a); }
}
