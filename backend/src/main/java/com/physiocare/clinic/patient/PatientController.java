package com.physiocare.clinic.patient;

import com.physiocare.clinic.common.BranchAccessService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.time.*;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/patients")
public class PatientController {
  private final JdbcTemplate db;
  private final BranchAccessService branches;

  public PatientController(JdbcTemplate db, BranchAccessService branches) {
    this.db = db;
    this.branches = branches;
  }

  public record PatientRequest(
      @NotBlank String customerType,
      @NotBlank String prefix,
      @NotBlank String firstNameTh,
      @NotBlank String lastNameTh,
      String firstNameEn,
      String lastNameEn,
      String nickname,
      @NotBlank String genderCode,
      String nationalIdHash,
      String nationalIdCiphertext,
      LocalDate birthDate,
      @NotBlank String phone,
      String email,
      String addressJson,
      String customerGroupCode,
      String referralChannelCode,
      String insuranceCompanyCode,
      @Positive long registeredBranchId) {}

  public record PatientView(
      long id,
      String hn,
      String prefix,
      String firstNameTh,
      String lastNameTh,
      String phone,
      String genderCode,
      String customerGroupCode,
      long branchId,
      boolean active) {}

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  @PreAuthorize("hasAnyRole('ADMIN','RECEPTIONIST','FINANCE')")
  @Transactional
  public PatientView create(@Valid @RequestBody PatientRequest r, Authentication authentication) {
    branches.requireAccess(authentication, r.registeredBranchId());
    branches.requireActiveBranch(r.registeredBranchId());
    String ym = YearMonth.now().toString().replace("-", "");
    int next =
        db.queryForObject(
            "INSERT INTO hn_sequences(branch_id,year_month,last_number) VALUES(?,?,1) ON"
                + " CONFLICT(branch_id,year_month) DO UPDATE SET"
                + " last_number=hn_sequences.last_number+1 RETURNING last_number",
            Integer.class,
            r.registeredBranchId(),
            ym);
    String code =
        db.queryForObject(
            "SELECT trim(code) FROM branches WHERE id=? AND active",
            String.class,
            r.registeredBranchId());
    if (code == null) throw new IllegalArgumentException("Invalid branch");
    String hn =
        String.format("%02d%s%s%04d", Year.now().getValue() % 100, code, ym.substring(4), next);
    long id =
        db.queryForObject(
            "INSERT INTO"
                + " patients(hn,registered_branch_id,customer_type,prefix,first_name_th,last_name_th,first_name_en,last_name_en,nickname,gender_code,national_id_hash,national_id_ciphertext,birth_date,phone,email,address,customer_group_code,referral_channel_code,insurance_company_code)"
                + " VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?::jsonb,?,?,?) RETURNING id",
            Long.class,
            hn,
            r.registeredBranchId(),
            r.customerType(),
            r.prefix(),
            r.firstNameTh(),
            r.lastNameTh(),
            r.firstNameEn(),
            r.lastNameEn(),
            r.nickname(),
            r.genderCode(),
            r.nationalIdHash(),
            r.nationalIdCiphertext(),
            r.birthDate(),
            r.phone(),
            r.email(),
            r.addressJson(),
            r.customerGroupCode(),
            r.referralChannelCode(),
            r.insuranceCompanyCode());
    return get(id, authentication);
  }

  @GetMapping
  public List<PatientView> list(
      @RequestParam(defaultValue = "") String search,
      @RequestParam(required = false) Long branchId,
      Authentication authentication) {
    branches.requireFilter(authentication, branchId);
    return db.query(
        "SELECT"
            + " id,hn,prefix,first_name_th,last_name_th,phone,gender_code,customer_group_code,registered_branch_id,active"
            + " FROM patients WHERE deleted_at IS NULL AND (?='' OR hn ILIKE ? OR first_name_th"
            + " ILIKE ? OR last_name_th ILIKE ? OR phone ILIKE ?) AND (CAST(? AS BIGINT) IS NULL OR"
            + " registered_branch_id=?) ORDER BY id DESC",
        (rs, n) ->
            new PatientView(
                rs.getLong(1),
                rs.getString(2),
                rs.getString(3),
                rs.getString(4),
                rs.getString(5),
                rs.getString(6),
                rs.getString(7),
                rs.getString(8),
                rs.getLong(9),
                rs.getBoolean(10)),
        search,
        "%" + search + "%",
        "%" + search + "%",
        "%" + search + "%",
        "%" + search + "%",
        branchId,
        branchId);
  }

  @GetMapping("/{id}")
  public PatientView get(@PathVariable long id, Authentication authentication) {
    Long branchId =
        db.queryForObject(
            "SELECT registered_branch_id FROM patients WHERE id=? AND deleted_at IS NULL",
            Long.class,
            id);
    if (branchId == null) throw new IllegalArgumentException("Patient not found");
    branches.requireAccess(authentication, branchId);
    return db.queryForObject(
        "SELECT"
            + " id,hn,prefix,first_name_th,last_name_th,phone,gender_code,customer_group_code,registered_branch_id,active"
            + " FROM patients WHERE id=? AND deleted_at IS NULL",
        (rs, n) ->
            new PatientView(
                rs.getLong(1),
                rs.getString(2),
                rs.getString(3),
                rs.getString(4),
                rs.getString(5),
                rs.getString(6),
                rs.getString(7),
                rs.getString(8),
                rs.getLong(9),
                rs.getBoolean(10)),
        id);
  }

  @PatchMapping("/{id}")
  @PreAuthorize("hasAnyRole('ADMIN','RECEPTIONIST')")
  public PatientView update(
      @PathVariable long id, @Valid @RequestBody PatientRequest r, Authentication authentication) {
    Long branchId =
        db.queryForObject(
            "SELECT registered_branch_id FROM patients WHERE id=? AND deleted_at IS NULL",
            Long.class,
            id);
    if (branchId == null) throw new IllegalArgumentException("Patient not found");
    branches.requireAccess(authentication, branchId);
    db.update(
        "UPDATE patients SET"
            + " prefix=?,first_name_th=?,last_name_th=?,first_name_en=?,last_name_en=?,nickname=?,gender_code=?,phone=?,email=?,customer_group_code=?,referral_channel_code=?,insurance_company_code=?,updated_at=now()"
            + " WHERE id=? AND deleted_at IS NULL",
        r.prefix(),
        r.firstNameTh(),
        r.lastNameTh(),
        r.firstNameEn(),
        r.lastNameEn(),
        r.nickname(),
        r.genderCode(),
        r.phone(),
        r.email(),
        r.customerGroupCode(),
        r.referralChannelCode(),
        r.insuranceCompanyCode(),
        id);
    return get(id, authentication);
  }
}
