package com.physiocare.clinic.patient;

import com.physiocare.clinic.common.BranchAccessService;
import com.physiocare.clinic.common.CurrentUser;
import com.physiocare.clinic.common.InputRules;
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
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@Service
public class PatientService {
  private final JdbcTemplate db;
  private final BranchAccessService branches;
  private final CurrentUser currentUser;
  private final PiiCryptoService pii;

  public PatientService(JdbcTemplate db, BranchAccessService branches, CurrentUser currentUser, PiiCryptoService pii) {
    this.db = db;
    this.branches = branches;
    this.currentUser = currentUser;
    this.pii = pii;
  }

  private static final String COLUMNS =
      "id,hn,customer_type,prefix,first_name_th,last_name_th,first_name_en,last_name_en,nickname,"
          + "gender_code,national_id_ciphertext,passport_ciphertext,birth_date,blood_group_code,nationality_code,"
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

  private static final List<String> CUSTOMER_TYPES = List.of("THAI", "FOREIGNER");
  private static final List<String> GENDERS = List.of("MALE", "FEMALE", "OTHER");

  /**
   * The registration form applies most of these too, but a record can also
   * arrive straight from the API, so the rules are enforced here as well.
   */
  private void validate(PatientRequest r) {
    validate(r, true);
  }

  /**
   * {@code requireNationalId} is false when editing a record that already
   * holds a national ID: the number is only ever stored as a hash, so the edit
   * form cannot echo it back, and a blank means "keep what is on file".
   */
  private void validate(PatientRequest r, boolean requireNationalId) {
    InputRules.oneOf(r.customerType(), CUSTOMER_TYPES, "Customer type");
    InputRules.oneOf(r.genderCode(), GENDERS, "Gender");
    InputRules.phone(r.phone());
    InputRules.email(r.email());
    InputRules.birthDate(r.birthDate());
    InputRules.nationalId(r.nationalId());
    InputRules.passport(r.passportNo());
    InputRules.text(r.firstNameTh(), 100, "First name");
    InputRules.text(r.lastNameTh(), 100, "Last name");
    InputRules.text(r.firstNameEn(), 100, "First name (EN)");
    InputRules.text(r.lastNameEn(), 100, "Last name (EN)");
    InputRules.text(r.nickname(), 100, "Nickname");
    InputRules.text(r.addressText(), 500, "Address");
    // A Thai patient is identified by their national ID, which is what keeps
    // the same person from being registered twice, and their name is held in
    // Thai. A foreigner's English name is copied into the same name columns, so
    // neither rule can be applied to every record.
    if ("THAI".equals(r.customerType())) {
      InputRules.require(
          !requireNationalId || (r.nationalId() != null && !r.nationalId().isBlank()),
          "A Thai patient needs a national ID");
      InputRules.thaiText(r.firstNameTh(), "First name");
      InputRules.thaiText(r.lastNameTh(), "Last name");
    }
  }

  @PostMapping
  @PreAuthorize("@permissionGuard.hasAny(authentication, 'patient.create')")
  @ResponseStatus(HttpStatus.CREATED)
  @Transactional
  public Map<String, Object> create(
      @Valid @RequestBody PatientRequest r, Authentication authentication) {
    validate(r);
    branches.requireAccess(authentication, r.registeredBranchId());
    branches.requireActiveBranch(r.registeredBranchId());

    String hn = nextHn(r.registeredBranchId());
    try {
      long id =
          db.queryForObject(
              "INSERT INTO patients(hn,registered_branch_id,customer_type,prefix,first_name_th,"
                  + "last_name_th,first_name_en,last_name_en,nickname,gender_code,national_id_hash,"
                  + "national_id_ciphertext,passport_hash,passport_ciphertext,birth_date,blood_group_code,"
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
              sha256(r.nationalId()),
              pii.encrypt(r.nationalId()),
              sha256(r.passportNo()),
              pii.encrypt(r.passportNo()),
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
      return decode(db.queryForMap("SELECT " + COLUMNS + " FROM patients WHERE id=?", id));
    } catch (DuplicateKeyException e) {
      throw new IllegalArgumentException("A patient with this national ID is already registered");
    }
  }

  @GetMapping
  public List<Map<String, Object>> list(
      @RequestParam(defaultValue = "") String search,
      @RequestParam(required = false) Long branchId,
      Authentication authentication) {
    // A non-admin must always select one of their branches.  Omitting the
    // filter must not turn the patient directory into a clinic-wide export.
    branches.requireFilter(authentication, branchId);
    String like = "%" + search + "%";
    return db.queryForList(
        "SELECT " + COLUMNS
            + " FROM patients WHERE deleted_at IS NULL AND (?='' OR hn ILIKE ? OR first_name_th"
            + " ILIKE ? OR last_name_th ILIKE ? OR nickname ILIKE ? OR phone ILIKE ?) AND"
            + " (?::bigint IS NULL OR registered_branch_id=? OR EXISTS (SELECT 1 FROM appointments a"
            + " WHERE a.patient_id=patients.id AND a.branch_id=?) OR EXISTS (SELECT 1 FROM sales_transactions st"
            + " WHERE st.patient_id=patients.id AND st.branch_id=?) OR EXISTS (SELECT 1 FROM patient_courses pc"
            + " WHERE pc.patient_id=patients.id AND pc.branch_id=?)) ORDER BY id DESC",
        search,
        like,
        like,
        like,
        like,
        like,
        branchId,
        branchId,
        branchId,
        branchId,
        branchId).stream().map(this::decode).toList();
  }

  @GetMapping("/{id}")
  public Map<String, Object> get(@PathVariable long id, Authentication authentication) {
    List<Map<String, Object>> rows =
        db.queryForList(
            "SELECT " + COLUMNS + " FROM patients WHERE id=? AND deleted_at IS NULL", id);
    if (rows.isEmpty()) throw new IllegalArgumentException("Patient not found");
    Map<String, Object> patient = decode(rows.get(0));
    branches.requirePatientAccess(authentication, id);
    return patient;
  }

  @PatchMapping("/{id}")
  @PreAuthorize("@permissionGuard.hasAny(authentication, 'patient.edit')")
  @Transactional
  public Map<String, Object> update(
      @PathVariable long id, @Valid @RequestBody PatientRequest r, Authentication authentication) {
    Map<String, Object> existing = get(id, authentication);
    boolean hasNationalId =
        Boolean.TRUE.equals(
            db.queryForObject(
                "SELECT national_id_hash IS NOT NULL FROM patients WHERE id=?", Boolean.class, id));
    validate(r, !hasNationalId);
    branches.requireAccess(
        authentication, ((Number) existing.get("registered_branch_id")).longValue());
    try {
      // A blank national ID or passport keeps the hash already on file — the
      // edit form never sees the original, so it cannot send it back.
      db.update(
          "UPDATE patients SET customer_type=?,prefix=?,first_name_th=?,last_name_th=?,"
              + "first_name_en=?,last_name_en=?,nickname=?,gender_code=?,"
          + "national_id_hash=COALESCE(?,national_id_hash),national_id_ciphertext=COALESCE(?,national_id_ciphertext),"
          + "passport_hash=COALESCE(?,passport_hash),passport_ciphertext=COALESCE(?,passport_ciphertext),birth_date=?,blood_group_code=?,"
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
          sha256(r.nationalId()),
          pii.encrypt(r.nationalId()),
          sha256(r.passportNo()),
          pii.encrypt(r.passportNo()),
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
    return get(id, authentication);
  }

  private Map<String, Object> decode(Map<String, Object> row) {
    String nationalId = pii.decrypt((String) row.remove("national_id_ciphertext"));
    String passport = pii.decrypt((String) row.remove("passport_ciphertext"));
    row.put("national_id", nationalId);
    row.put("passport_no", passport);
    return row;
  }

  /**
   * The HN the next registration at this branch would be given, without taking
   * it. The form shows this so the number on screen is the one the sequence
   * will actually mint — counting existing patients diverges from it as soon as
   * a record is removed, because the sequence only ever moves forward.
   *
   * <p>It is a forecast rather than a reservation: two people on the form at
   * once see the same number, and whoever saves second gets the one after. That
   * is the same promise the form made before, now measured against the sequence
   * instead of the patient list.
   */
  @GetMapping("/hn-preview")
  @PreAuthorize("@permissionGuard.hasAny(authentication, 'patient.create')")
  public Map<String, Object> hnPreview(
      @RequestParam long branchId, Authentication authentication) {
    branches.requireAccess(authentication, branchId);
    branches.requireActiveBranch(branchId);
    String yearMonth = YearMonth.now().toString().replace("-", "");
    int taken =
        db.queryForObject(
            "SELECT coalesce(max(last_number),0) FROM hn_sequences WHERE branch_id=? AND"
                + " year_month=?",
            Integer.class,
            branchId,
            yearMonth);
    return Map.of("hn", formatHn(branchCode(branchId), yearMonth, taken + 1));
  }

  /**
   * HN is YY + branch code + MM + a 4-digit running number that restarts every
   * month per branch, per the workflow brief.
   */
  private String nextHn(long branchId) {
    String yearMonth = YearMonth.now().toString().replace("-", "");
    String branchCode = branchCode(branchId);
    Integer running =
        db.queryForObject(
            "INSERT INTO hn_sequences(branch_id,year_month,last_number) VALUES(?,?,1) ON"
                + " CONFLICT(branch_id,year_month) DO UPDATE SET"
                + " last_number=hn_sequences.last_number+1 RETURNING last_number",
            Integer.class,
            branchId,
            yearMonth);
    return formatHn(branchCode, yearMonth, running);
  }

  private String branchCode(long branchId) {
    String code =
        db.queryForObject(
            "SELECT trim(code) FROM branches WHERE id=? AND active AND deleted_at IS NULL",
            String.class,
            branchId);
    if (code == null) throw new IllegalArgumentException("Invalid or inactive branch");
    return code;
  }

  private static String formatHn(String branchCode, String yearMonth, int running) {
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
