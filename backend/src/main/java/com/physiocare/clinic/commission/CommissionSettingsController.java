package com.physiocare.clinic.commission;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/commission/settings")
@PreAuthorize("hasRole('ADMIN')")
public class CommissionSettingsController {
  private final JdbcTemplate db;

  public CommissionSettingsController(JdbcTemplate db) {
    this.db = db;
  }

  public record Tier(
      @Positive int order,
      @NotNull @DecimalMin("0") BigDecimal min,
      BigDecimal max,
      @NotNull @DecimalMin("0") BigDecimal rate) {}

  public record Scheme(
      @NotBlank String code,
      @NotNull LocalDate effectiveFrom,
      LocalDate effectiveTo,
      @NotEmpty List<@Valid Tier> tiers) {}

  @GetMapping
  public Object list() {
    return db.queryForList(
        "SELECT"
            + " s.code,s.version,s.effective_from,s.effective_to,t.tier_order,t.minimum_monthly_sales,t.maximum_monthly_sales,t.commission_rate"
            + " FROM commission_schemes s JOIN commission_tiers t ON t.scheme_id=s.id ORDER BY"
            + " s.version DESC,t.tier_order");
  }

  @PostMapping
  @Transactional
  public Object create(@Valid @RequestBody Scheme r) {
    List<Tier> tiers = new ArrayList<>(r.tiers());
    tiers.sort(Comparator.comparing(Tier::min));
    for (int i = 0; i < tiers.size(); i++) {
      Tier a = tiers.get(i);
      if (a.max() != null && a.max().compareTo(a.min()) < 0)
        throw new IllegalArgumentException("Tier maximum must be >= minimum");
      if (i > 0) {
        Tier p = tiers.get(i - 1);
        if (p.max() == null || p.max().add(BigDecimal.valueOf(.01)).compareTo(a.min()) > 0)
          throw new IllegalArgumentException("Tier ranges overlap or are invalid");
      }
    }
    Integer version =
        db.queryForObject(
            "SELECT COALESCE(max(version),0)+1 FROM commission_schemes WHERE code=?",
            Integer.class,
            r.code());
    long id =
        db.queryForObject(
            "INSERT INTO commission_schemes(code,version,effective_from,effective_to)"
                + " VALUES(?,?,?,?) RETURNING id",
            Long.class,
            r.code(),
            version,
            r.effectiveFrom(),
            r.effectiveTo());
    for (Tier t : tiers)
      db.update(
          "INSERT INTO"
              + " commission_tiers(scheme_id,tier_order,minimum_monthly_sales,maximum_monthly_sales,commission_rate)"
              + " VALUES(?,?,?,?,?)",
          id,
          t.order(),
          t.min(),
          t.max(),
          t.rate());
    return Map.of("id", id, "code", r.code(), "version", version);
  }
}
