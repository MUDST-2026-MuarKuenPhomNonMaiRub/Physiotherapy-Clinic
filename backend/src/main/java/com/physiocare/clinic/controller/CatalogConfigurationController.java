package com.physiocare.clinic.controller;

import com.physiocare.clinic.dto.catalog.CatalogConfigurationDtos.CategoryRequest;
import com.physiocare.clinic.dto.catalog.CatalogConfigurationDtos.PaymentRequest;
import com.physiocare.clinic.service.CatalogConfigurationService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
public class CatalogConfigurationController {
  private final CatalogConfigurationService service;

  public CatalogConfigurationController(CatalogConfigurationService service) { this.service = service; }

  @PostMapping("/payment-methods")
  @ResponseStatus(HttpStatus.CREATED)
  @PreAuthorize("@permissionGuard.hasAny(authentication, 'settings.manage')")
  public Map<String, Object> createPayment(@Valid @RequestBody PaymentRequest request) {
    return service.createPayment(request);
  }

  @PatchMapping("/payment-methods/{id}")
  @PreAuthorize("@permissionGuard.hasAny(authentication, 'settings.manage')")
  public Map<String, Object> updatePayment(@PathVariable long id, @Valid @RequestBody PaymentRequest request) {
    return service.updatePayment(id, request);
  }

  @GetMapping("/master-data-categories")
  public List<Map<String, Object>> categories() { return service.categories(); }

  @DeleteMapping("/payment-methods/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  @PreAuthorize("@permissionGuard.hasAny(authentication, 'settings.manage')")
  public void deletePayment(@PathVariable long id) { service.deletePayment(id); }

  @DeleteMapping("/master-data/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  @PreAuthorize("@permissionGuard.hasAny(authentication, 'settings.manage')")
  public void deleteValue(@PathVariable long id) { service.deleteValue(id); }

  @DeleteMapping("/master-data-categories/{code}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  @PreAuthorize("@permissionGuard.hasAny(authentication, 'settings.manage')")
  public void deleteCategory(@PathVariable String code) { service.deleteCategory(code); }

  @PostMapping("/master-data-categories")
  @ResponseStatus(HttpStatus.CREATED)
  @PreAuthorize("@permissionGuard.hasAny(authentication, 'settings.manage')")
  public Map<String, Object> createCategory(@Valid @RequestBody CategoryRequest request) {
    return service.createCategory(request);
  }

  @PatchMapping("/master-data-categories/{code}")
  @PreAuthorize("@permissionGuard.hasAny(authentication, 'settings.manage')")
  public Map<String, Object> updateCategory(@PathVariable String code, @Valid @RequestBody CategoryRequest request) {
    return service.updateCategory(code, request);
  }
}
