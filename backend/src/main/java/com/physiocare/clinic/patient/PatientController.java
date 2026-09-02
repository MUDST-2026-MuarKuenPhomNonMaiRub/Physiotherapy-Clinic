package com.physiocare.clinic.patient;

import com.physiocare.clinic.common.BranchAccessService;
import com.physiocare.clinic.common.CurrentUser;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDate;
import java.time.Year;
import java.time.YearMonth;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import org.springframework.dao.DuplicateKeyException;
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
  private final CurrentUser currentUser;

  public PatientController(JdbcTemplate db, BranchAccessService branches, CurrentUser currentUser) {
    this.db = db;
    this.branches = branches;
    this.currentUser = currentUser;
  }

  private static final String COLUMNS =
      "id,hn,customer_type,prefix,first_name_th,last_name_th,first_name_en,last_name_en,nickname,"
          + "gender_code,national_id,passport_no,birth_date,blood_group_code,nationality_code,"
          + "phone,email,address_text,customer_group_code,referral_channel_code,"
          + "insurance_company_code,registered_branch_id,registered_at,active";

  public record PatientRequest(
      @NotBlank String customerType,
      @NotBlank String prefix,
      @NotBlank String firstNameTh,
      @NotBlank String lastNameTh,
      String firstNameEn,
      String lastNameEn,
      String nickname,
      @NotBlank String genderCode,
      String nationalId,
      String passportNo,
      LocalDate birthDate,
      String bloodGroupCode,
      String nationalityCode,
      @NotBlank String phone,
      String email,
      String addressText,
      String customerGroupCode,
      String referralChannelCode,
      String insuranceCompanyCode,
      @Positive long registeredBranchId) {}

  @PostMapping
  @PreAuthorize("hasAnyRole('ADMIN','PHYSIO','RECEPTIONIST','FINANCE')")
  @ResponseStatus(HttpStatus.CREATED)
  @Transactional
  public Map<String, Object> create(
      @Valid @RequestBody PatientRequest r, Authentication authentication) {
    branches.requireAccess(authentication, r.registeredBranchId());
    branches.requireActiveBranch(r.registeredBranchId());

    String hn = nextHn(r.registeredBranchId());
    try {
      long id =
          db.queryForObject(
              "INSERT INTO patients(hn,registered_branch_id,customer_type,prefix,first_name_th,"
                  + "last_name_th,first_name_en,last_name_en,nickname,gender_code,national_id,"
                  + "national_id_hash,passport_no,passport_hash,birth_date,blood_group_code,"
                  + "nationality_code,phone,email,address_text,customer_group_code,"
                  + "referral_channel_code,insurance_company_code,created_by)"
                  + " VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) RETURNING id",
              Long.class,
              hn,
              r.registeredBranchId(),
              r.customerType(),
              r.prefix(),
              r.firstNameTh(),
              r.lastNameTh(),
              blankToNull(r.firstNameEn()),
              blankToNull(r.lastNameEn()),
              blankToNull(r.nickname()),
              r.genderCode(),
              blankToNull(r.nationalId()),
              sha256(r.nationalId()),
              blankToNull(r.passportNo()),
              sha256(r.passportNo()),
              r.birthDate(),
              blankToNull(r.bloodGroupCode()),
              blankToNull(r.nationalityCode()),
              r.phone(),
              blankToNull(r.email()),
              r.addressText() == null ? "" : r.addressText(),
              blankToNull(r.customerGroupCode()),
              blankToNull(r.referralChannelCode()),
              blankToNull(r.insuranceCompanyCode()),
              currentUser.id(authentication));
      return db.queryForMap("SELECT " + COLUMNS + " FROM patients WHERE id=?", id);
    } catch (DuplicateKeyException e) {
      throw new IllegalArgumentException("A patient with this national ID is already registered");
    }
  }

  @GetMapping
  public List<Map<String, Object>> list(
      @RequestParam(defaultValue = "") String search,
      @RequestParam(required = false) Long branchId,
      Authentication authentication) {
    if (branchId != null) branches.requireAccess(authentication, branchId);
    String like = "%" + search + "%";
    return db.queryForList(
        "SELECT " + COLUMNS
            + " FROM patients WHERE deleted_at IS NULL AND (?='' OR hn ILIKE ? OR first_name_th"
            + " ILIKE ? OR last_name_th ILIKE ? OR nickname ILIKE ? OR phone ILIKE ?) AND"
            + " (?::bigint IS NULL OR registered_branch_id=?) ORDER BY id DESC",
        search,
        like,
        like,
        like,
        like,
        like,
        branchId,
        branchId);
  }

  @GetMapping("/{id}")
  public Map<String, Object> get(@PathVariable long id) {
    List<Map<String, Object>> rows =
        db.queryForList(
            "SELECT " + COLUMNS + " FROM patients WHERE id=? AND deleted_at IS NULL", id);
    if (rows.isEmpty()) throw new IllegalArgumentException("Patient not found");
    return rows.get(0);
  }

  @PatchMapping("/{id}")
  @PreAuthorize("hasAnyRole('ADMIN','PHYSIO','RECEPTIONIST')")
  @Transactional
  public Map<String, Object> update(
      @PathVariable long id, @Valid @RequestBody PatientRequest r, Authentication authentication) {
    Map<String, Object> existing = get(id);
    branches.requireAccess(
        authentication, ((Number) existing.get("registered_branch_id")).longValue());
    try {
      db.update(
          "UPDATE patients SET customer_type=?,prefix=?,first_name_th=?,last_name_th=?,"
              + "first_name_en=?,last_name_en=?,nickname=?,gender_code=?,national_id=?,"
              + "national_id_hash=?,passport_no=?,passport_hash=?,birth_date=?,blood_group_code=?,"
              + "nationality_code=?,phone=?,email=?,address_text=?,customer_group_code=?,"
              + "referral_channel_code=?,insurance_company_code=?,updated_at=now()"
              + " WHERE id=? AND deleted_at IS NULL",
          r.customerType(),
          r.prefix(),
          r.firstNameTh(),
          r.lastNameTh(),
          blankToNull(r.firstNameEn()),
          blankToNull(r.lastNameEn()),
          blankToNull(r.nickname()),
          r.genderCode(),
          blankToNull(r.nationalId()),
          sha256(r.nationalId()),
          blankToNull(r.passportNo()),
          sha256(r.passportNo()),
          r.birthDate(),
          blankToNull(r.bloodGroupCode()),
          blankToNull(r.nationalityCode()),
          r.phone(),
          blankToNull(r.email()),
          r.addressText() == null ? "" : r.addressText(),
          blankToNull(r.customerGroupCode()),
          blankToNull(r.referralChannelCode()),
          blankToNull(r.insuranceCompanyCode()),
          id);
    } catch (DuplicateKeyException e) {
      throw new IllegalArgumentException("A patient with this national ID is already registered");
    }
    return get(id);
  }

  /**
   * HN is YY + branch code + MM + a 4-digit running number that restarts every
   * month per branch, per the workflow brief.
   */
  private String nextHn(long branchId) {
    String yearMonth = YearMonth.now().toString().replace("-", "");
    String branchCode =
        db.queryForObject(
            "SELECT trim(code) FROM branches WHERE id=? AND active AND deleted_at IS NULL",
            String.class,
            branchId);
    if (branchCode == null) throw new IllegalArgumentException("Invalid or inactive branch");
    Integer running =
        db.queryForObject(
            "INSERT INTO hn_sequences(branch_id,year_month,last_number) VALUES(?,?,1) ON"
                + " CONFLICT(branch_id,year_month) DO UPDATE SET"
                + " last_number=hn_sequences.last_number+1 RETURNING last_number",
            Integer.class,
            branchId,
            yearMonth);
    return String.format(
        "%02d%s%s%04d",
        Year.now().getValue() % 100, branchCode, yearMonth.substring(4), running);
  }

  /** Kept so the unique index still catches a duplicate registration. */
  private static String sha256(String value) {
    if (value == null || value.isBlank()) return null;
    try {
      MessageDigest digest = MessageDigest.getInstance("SHA-256");
      return HexFormat.of().formatHex(digest.digest(value.trim().getBytes(StandardCharsets.UTF_8)));
    } catch (NoSuchAlgorithmException e) {
      throw new IllegalStateException("SHA-256 is unavailable", e);
    }
  }

  private static String blankToNull(String value) {
    return value == null || value.isBlank() ? null : value.trim();
  }
}
