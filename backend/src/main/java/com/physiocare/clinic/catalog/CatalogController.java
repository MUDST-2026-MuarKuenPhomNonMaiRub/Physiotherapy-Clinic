package com.physiocare.clinic.catalog;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

/** HTTP adapter for catalogue management. Business and persistence logic live in CatalogService. */
@RestController
@RequestMapping("/api/v1")
public class CatalogController {
  private final CatalogService service;

  public CatalogController(CatalogService service) { this.service = service; }

  public record ServiceRequest(String code, @NotBlank String nameTh, String nameEn,
      @NotBlank String serviceType, @Positive int durationMinutes,
      @NotNull @DecimalMin("0") BigDecimal basePrice, Boolean active) {}
  public record CourseRequest(String code, @NotBlank String nameTh, String nameEn,
      String description, @Positive int totalSessions, @PositiveOrZero int bonusSessions,
      @Positive Integer validityDays, @NotNull @DecimalMin("0") BigDecimal price, Boolean active) {}
  public record MasterDataRequest(@NotBlank String dataType, @NotBlank String nameTh,
      String nameEn, Boolean active) {}
  public record ActiveRequest(boolean active) {}

  @GetMapping("/services")
  public List<Map<String, Object>> services() { return service.services(); }
  @PostMapping("/services") @ResponseStatus(HttpStatus.CREATED)
  public Map<String, Object> addService(@Valid @RequestBody ServiceRequest r) { return service.addService(toService(r)); }
  @PatchMapping("/services/{id}")
  public Map<String, Object> updateService(@PathVariable long id, @Valid @RequestBody ServiceRequest r) { return service.updateService(id, toService(r)); }
  @PatchMapping("/services/{id}/status")
  public Map<String, Object> setServiceStatus(@PathVariable long id, @RequestBody ActiveRequest r) { return service.setServiceStatus(id, new CatalogService.ActiveRequest(r.active())); }

  @GetMapping("/courses")
  public List<Map<String, Object>> courses() { return service.courses(); }
  @PostMapping("/courses") @ResponseStatus(HttpStatus.CREATED)
  public Map<String, Object> addCourse(@Valid @RequestBody CourseRequest r) { return service.addCourse(toCourse(r)); }
  @PatchMapping("/courses/{id}")
  public Map<String, Object> updateCourse(@PathVariable long id, @Valid @RequestBody CourseRequest r) { return service.updateCourse(id, toCourse(r)); }
  @PatchMapping("/courses/{id}/status")
  public Map<String, Object> setCourseStatus(@PathVariable long id, @RequestBody ActiveRequest r) { return service.setCourseStatus(id, new CatalogService.ActiveRequest(r.active())); }

  @GetMapping("/payment-methods")
  public List<Map<String, Object>> payments() { return service.payments(); }
  @PatchMapping("/payment-methods/{id}/status")
  public Map<String, Object> setPaymentMethodStatus(@PathVariable long id, @RequestBody ActiveRequest r) { return service.setPaymentMethodStatus(id, new CatalogService.ActiveRequest(r.active())); }

  @GetMapping("/master-data")
  public List<Map<String, Object>> allMasterData() { return service.allMasterData(); }
  @GetMapping("/master-data/{type}")
  public List<Map<String, Object>> master(@PathVariable String type) { return service.master(type); }
  @PostMapping("/master-data") @ResponseStatus(HttpStatus.CREATED)
  public Map<String, Object> addMasterData(@Valid @RequestBody MasterDataRequest r) { return service.addMasterData(new CatalogService.MasterDataRequest(r.dataType(), r.nameTh(), r.nameEn(), r.active())); }
  @PatchMapping("/master-data/{id}")
  public Map<String, Object> updateMasterData(@PathVariable long id, @RequestBody MasterDataRequest r) { return service.updateMasterData(id, new CatalogService.MasterDataRequest(r.dataType(), r.nameTh(), r.nameEn(), r.active())); }
  @PatchMapping("/master-data/{id}/status")
  public Map<String, Object> setMasterDataStatus(@PathVariable long id, @RequestBody ActiveRequest r) { return service.setMasterDataStatus(id, new CatalogService.ActiveRequest(r.active())); }

  private static CatalogService.ServiceRequest toService(ServiceRequest r) {
    return new CatalogService.ServiceRequest(r.code(), r.nameTh(), r.nameEn(), r.serviceType(), r.durationMinutes(), r.basePrice(), r.active());
  }
  private static CatalogService.CourseRequest toCourse(CourseRequest r) {
    return new CatalogService.CourseRequest(r.code(), r.nameTh(), r.nameEn(), r.description(), r.totalSessions(), r.bonusSessions(), r.validityDays(), r.price(), r.active());
  }
}
