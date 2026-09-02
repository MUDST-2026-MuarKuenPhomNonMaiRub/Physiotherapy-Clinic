package com.physiocare.clinic.catalog;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

/** Back-office catalogue: what the clinic screens are allowed to sell and select. */
@RestController
@RequestMapping("/api/v1")
public class CatalogController {
  private final JdbcTemplate db;

  public CatalogController(JdbcTemplate db) {
    this.db = db;
  }

  public record ServiceRequest(
      String code,
      @NotBlank String nameTh,
      String nameEn,
      @NotBlank String serviceType,
      @Positive int durationMinutes,
      @NotNull @DecimalMin("0") BigDecimal basePrice,
      Boolean active) {}

  public record CourseRequest(
      String code,
      @NotBlank String nameTh,
      String nameEn,
      String description,
      @Positive int totalSessions,
      @PositiveOrZero int bonusSessions,
      @Positive Integer validityDays,
      @NotNull @DecimalMin("0") BigDecimal price,
      Boolean active) {}

  public record MasterDataRequest(
      @NotBlank String dataType, @NotBlank String nameTh, String nameEn, Boolean active) {}

  public record ActiveRequest(boolean active) {}

  // ---------------------------------------------------------------- services

  @GetMapping("/services")
  public List<Map<String, Object>> services() {
    return db.queryForList(
        "SELECT id,code,name_th,name_en,service_type,duration_minutes,base_price,active FROM"
            + " services WHERE deleted_at IS NULL ORDER BY id");
  }

  @PostMapping("/services")
  @ResponseStatus(HttpStatus.CREATED)
  @PreAuthorize("hasRole('ADMIN')")
  public Map<String, Object> addService(@Valid @RequestBody ServiceRequest r) {
    long id =
        db.queryForObject(
            "INSERT INTO"
                + " services(code,name_th,name_en,service_type,duration_minutes,base_price,active)"
                + " VALUES(?,?,?,?,?,?,?) RETURNING id",
            Long.class,
            nextCode(r.code(), "SVC", "services"),
            r.nameTh(),
            r.nameEn() == null ? r.nameTh() : r.nameEn(),
            r.serviceType(),
            r.durationMinutes(),
            r.basePrice(),
            r.active() == null || r.active());
    return service(id);
  }

  @PatchMapping("/services/{id}")
  @PreAuthorize("hasRole('ADMIN')")
  public Map<String, Object> updateService(
      @PathVariable long id, @Valid @RequestBody ServiceRequest r) {
    int rows =
        db.update(
            "UPDATE services SET"
                + " name_th=?,name_en=?,service_type=?,duration_minutes=?,base_price=?,active=COALESCE(?,active),updated_at=now()"
                + " WHERE id=? AND deleted_at IS NULL",
            r.nameTh(),
            r.nameEn() == null ? r.nameTh() : r.nameEn(),
            r.serviceType(),
            r.durationMinutes(),
            r.basePrice(),
            r.active(),
            id);
    if (rows == 0) throw new IllegalArgumentException("Service not found");
    return service(id);
  }

  @PatchMapping("/services/{id}/status")
  @PreAuthorize("hasRole('ADMIN')")
  public Map<String, Object> setServiceStatus(
      @PathVariable long id, @RequestBody ActiveRequest r) {
    int rows =
        db.update(
            "UPDATE services SET active=?,updated_at=now() WHERE id=? AND deleted_at IS NULL",
            r.active(),
            id);
    if (rows == 0) throw new IllegalArgumentException("Service not found");
    return service(id);
  }

  private Map<String, Object> service(long id) {
    return db.queryForMap(
        "SELECT id,code,name_th,name_en,service_type,duration_minutes,base_price,active FROM"
            + " services WHERE id=?",
        id);
  }

  // ----------------------------------------------------------------- courses

  @GetMapping("/courses")
  public List<Map<String, Object>> courses() {
    return db.queryForList(
        "SELECT id,code,name_th,name_en,description,total_sessions,bonus_sessions,validity_days,price,active"
            + " FROM courses WHERE deleted_at IS NULL ORDER BY id");
  }

  @PostMapping("/courses")
  @ResponseStatus(HttpStatus.CREATED)
  @PreAuthorize("hasRole('ADMIN')")
  public Map<String, Object> addCourse(@Valid @RequestBody CourseRequest r) {
    long id =
        db.queryForObject(
            "INSERT INTO"
                + " courses(code,name_th,name_en,description,total_sessions,bonus_sessions,validity_days,price,active)"
                + " VALUES(?,?,?,?,?,?,?,?,?) RETURNING id",
            Long.class,
            nextCode(r.code(), "CRS", "courses"),
            r.nameTh(),
            r.nameEn() == null ? r.nameTh() : r.nameEn(),
            r.description() == null ? "" : r.description(),
            r.totalSessions(),
            r.bonusSessions(),
            r.validityDays(),
            r.price(),
            r.active() == null || r.active());
    return course(id);
  }

  @PatchMapping("/courses/{id}")
  @PreAuthorize("hasRole('ADMIN')")
  public Map<String, Object> updateCourse(
      @PathVariable long id, @Valid @RequestBody CourseRequest r) {
    int rows =
        db.update(
            "UPDATE courses SET"
                + " name_th=?,name_en=?,description=?,total_sessions=?,bonus_sessions=?,validity_days=?,price=?,active=COALESCE(?,active),updated_at=now()"
                + " WHERE id=? AND deleted_at IS NULL",
            r.nameTh(),
            r.nameEn() == null ? r.nameTh() : r.nameEn(),
            r.description() == null ? "" : r.description(),
            r.totalSessions(),
            r.bonusSessions(),
            r.validityDays(),
            r.price(),
            r.active(),
            id);
    if (rows == 0) throw new IllegalArgumentException("Course not found");
    return course(id);
  }

  @PatchMapping("/courses/{id}/status")
  @PreAuthorize("hasRole('ADMIN')")
  public Map<String, Object> setCourseStatus(@PathVariable long id, @RequestBody ActiveRequest r) {
    int rows =
        db.update(
            "UPDATE courses SET active=?,updated_at=now() WHERE id=? AND deleted_at IS NULL",
            r.active(),
            id);
    if (rows == 0) throw new IllegalArgumentException("Course not found");
    return course(id);
  }

  private Map<String, Object> course(long id) {
    return db.queryForMap(
        "SELECT id,code,name_th,name_en,description,total_sessions,bonus_sessions,validity_days,price,active"
            + " FROM courses WHERE id=?",
        id);
  }

  // --------------------------------------------------------- payment methods

  @GetMapping("/payment-methods")
  public List<Map<String, Object>> payments() {
    return db.queryForList(
        "SELECT id,code,name,icon,requires_reference,requires_attachment,active FROM"
            + " payment_methods ORDER BY sort_order,id");
  }

  @PatchMapping("/payment-methods/{id}/status")
  @PreAuthorize("hasRole('ADMIN')")
  public Map<String, Object> setPaymentMethodStatus(
      @PathVariable long id, @RequestBody ActiveRequest r) {
    int rows = db.update("UPDATE payment_methods SET active=? WHERE id=?", r.active(), id);
    if (rows == 0) throw new IllegalArgumentException("Payment method not found");
    return db.queryForMap(
        "SELECT id,code,name,icon,requires_reference,requires_attachment,active FROM"
            + " payment_methods WHERE id=?",
        id);
  }

  // ------------------------------------------------------------- master data

  /** Every configurable dropdown value, for the settings screen and the forms. */
  @GetMapping("/master-data")
  public List<Map<String, Object>> allMasterData() {
    return db.queryForList(
        "SELECT id,data_type,code,name_th,name_en,sort_order,active FROM master_data_values ORDER"
            + " BY data_type,sort_order,id");
  }

  @GetMapping("/master-data/{type}")
  public List<Map<String, Object>> master(@PathVariable String type) {
    return db.queryForList(
        "SELECT id,data_type,code,name_th,name_en,sort_order,active FROM master_data_values WHERE"
            + " data_type=? ORDER BY sort_order,id",
        type.toUpperCase());
  }

  @PostMapping("/master-data")
  @ResponseStatus(HttpStatus.CREATED)
  @PreAuthorize("hasRole('ADMIN')")
  public Map<String, Object> addMasterData(@Valid @RequestBody MasterDataRequest r) {
    String type = r.dataType().toUpperCase();
    Integer nextOrder =
        db.queryForObject(
            "SELECT COALESCE(max(sort_order),0)+1 FROM master_data_values WHERE data_type=?",
            Integer.class,
            type);
    long id =
        db.queryForObject(
            "INSERT INTO master_data_values(data_type,code,name_th,name_en,sort_order,active)"
                + " VALUES(?,?,?,?,?,?) RETURNING id",
            Long.class,
            type,
            slug(r.nameTh(), type),
            r.nameTh(),
            r.nameEn() == null ? r.nameTh() : r.nameEn(),
            nextOrder,
            r.active() == null || r.active());
    return masterDataRow(id);
  }

  @PatchMapping("/master-data/{id}")
  @PreAuthorize("hasRole('ADMIN')")
  public Map<String, Object> updateMasterData(
      @PathVariable long id, @RequestBody MasterDataRequest r) {
    int rows =
        db.update(
            "UPDATE master_data_values SET name_th=COALESCE(?,name_th),"
                + " name_en=COALESCE(?,name_en), active=COALESCE(?,active) WHERE id=?",
            r.nameTh(),
            r.nameEn() == null ? r.nameTh() : r.nameEn(),
            r.active(),
            id);
    if (rows == 0) throw new IllegalArgumentException("Master data value not found");
    return masterDataRow(id);
  }

  @PatchMapping("/master-data/{id}/status")
  @PreAuthorize("hasRole('ADMIN')")
  public Map<String, Object> setMasterDataStatus(
      @PathVariable long id, @RequestBody ActiveRequest r) {
    int rows = db.update("UPDATE master_data_values SET active=? WHERE id=?", r.active(), id);
    if (rows == 0) throw new IllegalArgumentException("Master data value not found");
    return masterDataRow(id);
  }

  private Map<String, Object> masterDataRow(long id) {
    return db.queryForMap(
        "SELECT id,data_type,code,name_th,name_en,sort_order,active FROM master_data_values WHERE"
            + " id=?",
        id);
  }

  // ------------------------------------------------------------------ helpers

  /** Codes are a back-office convenience; generate one when the caller omits it. */
  private String nextCode(String supplied, String prefix, String table) {
    if (supplied != null && !supplied.isBlank()) return supplied.trim().toUpperCase();
    Long count = db.queryForObject("SELECT count(*)+1 FROM " + table, Long.class);
    String candidate = String.format("%s-%03d", prefix, count);
    while (Boolean.TRUE.equals(
        db.queryForObject(
            "SELECT EXISTS(SELECT 1 FROM " + table + " WHERE code=?)", Boolean.class, candidate))) {
      count++;
      candidate = String.format("%s-%03d", prefix, count);
    }
    return candidate;
  }

  private String slug(String name, String type) {
    String base =
        name.trim().toUpperCase().replaceAll("[^A-Z0-9]+", "_").replaceAll("(^_|_$)", "");
    if (base.isBlank()) base = "VALUE";
    if (base.length() > 50) base = base.substring(0, 50);
    String candidate = base;
    int suffix = 2;
    while (Boolean.TRUE.equals(
        db.queryForObject(
            "SELECT EXISTS(SELECT 1 FROM master_data_values WHERE data_type=? AND code=?)",
            Boolean.class,
            type,
            candidate))) {
      candidate = base + "_" + suffix++;
    }
    return candidate;
  }
}
