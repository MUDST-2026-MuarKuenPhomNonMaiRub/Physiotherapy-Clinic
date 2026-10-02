package com.physiocare.clinic.controller;

import com.physiocare.clinic.dto.catalog.CatalogDtos.ActiveRequest;
import com.physiocare.clinic.dto.catalog.CatalogDtos.CourseRequest;
import com.physiocare.clinic.dto.catalog.CatalogDtos.MasterDataRequest;
import com.physiocare.clinic.dto.catalog.CatalogDtos.ServiceRequest;
import com.physiocare.clinic.service.CatalogService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

/** HTTP adapter for catalogue management. Business and persistence logic live in CatalogService. */
@RestController
@RequestMapping("/api/v1")
public class CatalogController {
  private final CatalogService service;

  public CatalogController(CatalogService service) { this.service = service; }

  @GetMapping("/services")
  public List<Map<String, Object>> services() { return service.services(); }
  @PostMapping("/services") @ResponseStatus(HttpStatus.CREATED)
  @PreAuthorize("@permissionGuard.hasAny(authentication, 'settings.manage')")
  public Map<String, Object> addService(@Valid @RequestBody ServiceRequest r) { return service.addService(r); }
  @PatchMapping("/services/{id}")
  @PreAuthorize("@permissionGuard.hasAny(authentication, 'settings.manage')")
  public Map<String, Object> updateService(@PathVariable long id, @Valid @RequestBody ServiceRequest r) { return service.updateService(id, r); }
  @PatchMapping("/services/{id}/status")
  @PreAuthorize("@permissionGuard.hasAny(authentication, 'settings.manage')")
  public Map<String, Object> setServiceStatus(@PathVariable long id, @RequestBody ActiveRequest r) { return service.setServiceStatus(id, r); }

  @GetMapping("/courses")
  public List<Map<String, Object>> courses() { return service.courses(); }
  @PostMapping("/courses") @ResponseStatus(HttpStatus.CREATED)
  @PreAuthorize("@permissionGuard.hasAny(authentication, 'settings.manage')")
  public Map<String, Object> addCourse(@Valid @RequestBody CourseRequest r) { return service.addCourse(r); }
  @PatchMapping("/courses/{id}")
  @PreAuthorize("@permissionGuard.hasAny(authentication, 'settings.manage')")
  public Map<String, Object> updateCourse(@PathVariable long id, @Valid @RequestBody CourseRequest r) { return service.updateCourse(id, r); }
  @PatchMapping("/courses/{id}/status")
  @PreAuthorize("@permissionGuard.hasAny(authentication, 'settings.manage')")
  public Map<String, Object> setCourseStatus(@PathVariable long id, @RequestBody ActiveRequest r) { return service.setCourseStatus(id, r); }

  @GetMapping("/payment-methods")
  public List<Map<String, Object>> payments() { return service.payments(); }
  @PatchMapping("/payment-methods/{id}/status")
  @PreAuthorize("@permissionGuard.hasAny(authentication, 'settings.manage')")
  public Map<String, Object> setPaymentMethodStatus(@PathVariable long id, @RequestBody ActiveRequest r) { return service.setPaymentMethodStatus(id, r); }

  @GetMapping("/master-data")
  public List<Map<String, Object>> allMasterData() { return service.allMasterData(); }
  @GetMapping("/master-data/{type}")
  public List<Map<String, Object>> master(@PathVariable String type) { return service.master(type); }
  @PostMapping("/master-data") @ResponseStatus(HttpStatus.CREATED)
  @PreAuthorize("@permissionGuard.hasAny(authentication, 'settings.manage')")
  public Map<String, Object> addMasterData(@Valid @RequestBody MasterDataRequest r) { return service.addMasterData(r); }
  @PatchMapping("/master-data/{id}")
  @PreAuthorize("@permissionGuard.hasAny(authentication, 'settings.manage')")
  public Map<String, Object> updateMasterData(@PathVariable long id, @RequestBody MasterDataRequest r) { return service.updateMasterData(id, r); }
  @PatchMapping("/master-data/{id}/status")
  @PreAuthorize("@permissionGuard.hasAny(authentication, 'settings.manage')")
  public Map<String, Object> setMasterDataStatus(@PathVariable long id, @RequestBody ActiveRequest r) { return service.setMasterDataStatus(id, r); }
}
