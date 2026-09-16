package com.physiocare.clinic.commission;

import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

/** HTTP adapter for line-level commission rules. */
@RestController
@RequestMapping("/api/v1/commission-rules")
public class CommissionRuleController {
  private final CommissionRuleService service;
  public CommissionRuleController(CommissionRuleService service) { this.service=service; }
  @GetMapping public List<Map<String,Object>> list(){return service.list();}
  @PostMapping @ResponseStatus(HttpStatus.CREATED)
  @PreAuthorize("@permissionGuard.hasAny(authentication, 'settings.manage')")
  public Map<String,Object> create(@Valid @RequestBody CommissionRuleService.RuleRequest r){return service.create(r);}
  @PatchMapping("/{id}")
  @PreAuthorize("@permissionGuard.hasAny(authentication, 'settings.manage')")
  public Map<String,Object> update(@PathVariable long id,@Valid @RequestBody CommissionRuleService.RuleRequest r){return service.update(id,r);}
  @PatchMapping("/{id}/status")
  @PreAuthorize("@permissionGuard.hasAny(authentication, 'settings.manage')")
  public Map<String,Object> setStatus(@PathVariable long id,@RequestBody CommissionRuleService.ActiveRequest r){return service.setStatus(id,r);}
}
