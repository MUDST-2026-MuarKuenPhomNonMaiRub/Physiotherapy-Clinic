package com.physiocare.clinic.catalog;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
public class CatalogController {
  private final JdbcTemplate db;

  public CatalogController(JdbcTemplate db) {
    this.db = db;
  }

  public record ServiceRequest(
      @NotBlank String code,
      @NotBlank String nameTh,
      String nameEn,
      @NotBlank String serviceType,
      @Positive int durationMinutes,
      @NotNull @DecimalMin("0") BigDecimal basePrice) {}

  public record CourseRequest(
      @NotBlank String code,
      @NotBlank String nameTh,
      String nameEn,
      @Positive int totalSessions,
      @Positive Integer validityDays,
      @NotNull @DecimalMin("0") BigDecimal price) {}

  @GetMapping("/services")
  public List<?> services() {
    return db.queryForList(
        "SELECT id,code,name_th,name_en,service_type,duration_minutes,base_price,active FROM"
            + " services WHERE deleted_at IS NULL ORDER BY code");
  }

  @PostMapping("/services")
  @ResponseStatus(HttpStatus.CREATED)
  @PreAuthorize("hasRole('ADMIN')")
  public Object addService(@Valid @RequestBody ServiceRequest r) {
    long id =
        db.queryForObject(
            "INSERT INTO services(code,name_th,name_en,service_type,duration_minutes,base_price)"
                + " VALUES(?,?,?,?,?,?) RETURNING id",
            Long.class,
            r.code(),
            r.nameTh(),
            r.nameEn(),
            r.serviceType(),
            r.durationMinutes(),
            r.basePrice());
    return db.queryForMap("SELECT * FROM services WHERE id=?", id);
  }

  @GetMapping("/courses")
  public List<?> courses() {
    return db.queryForList(
        "SELECT id,code,name_th,name_en,total_sessions,validity_days,price,active FROM courses"
            + " WHERE deleted_at IS NULL ORDER BY code");
  }

  @PostMapping("/courses")
  @ResponseStatus(HttpStatus.CREATED)
  @PreAuthorize("hasRole('ADMIN')")
  public Object addCourse(@Valid @RequestBody CourseRequest r) {
    long id =
        db.queryForObject(
            "INSERT INTO courses(code,name_th,name_en,total_sessions,validity_days,price)"
                + " VALUES(?,?,?,?,?,?) RETURNING id",
            Long.class,
            r.code(),
            r.nameTh(),
            r.nameEn(),
            r.totalSessions(),
            r.validityDays(),
            r.price());
    return db.queryForMap("SELECT * FROM courses WHERE id=?", id);
  }

  @GetMapping("/payment-methods")
  public List<?> payments() {
    return db.queryForList(
        "SELECT id,code,name,requires_reference,requires_attachment,active FROM payment_methods"
            + " WHERE active ORDER BY code");
  }

  @GetMapping("/master-data/{type}")
  public List<?> master(@PathVariable String type) {
    return db.queryForList(
        "SELECT id,data_type,code,name_th,name_en,sort_order,metadata,active FROM"
            + " master_data_values WHERE data_type=? AND active ORDER BY sort_order,code",
        type.toUpperCase());
  }
}
