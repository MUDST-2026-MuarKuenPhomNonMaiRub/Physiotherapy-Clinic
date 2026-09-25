package com.physiocare.clinic.staff;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.physiocare.clinic.auth.*;
import com.physiocare.clinic.common.InputRules;
import com.physiocare.clinic.integration.google.service.GoogleCalendarSyncService;
import jakarta.transaction.Transactional;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class StaffService {
  private final StaffRepository staff;
  private final AppUserRepository users;
  private final RoleRepository roles;
  private final PasswordEncoder encoder;
  private final JdbcTemplate db;
  private final ObjectMapper objectMapper;
  private final GoogleCalendarSyncService calendarSync;

  public StaffService(
      StaffRepository s,
      AppUserRepository u,
      RoleRepository r,
      PasswordEncoder e,
      JdbcTemplate db,
      ObjectMapper objectMapper,
      GoogleCalendarSyncService calendarSync) {
    staff = s;
    users = u;
    roles = r;
    encoder = e;
    this.db = db;
    this.objectMapper = objectMapper;
    this.calendarSync = calendarSync;
  }

  @Transactional
  public StaffDtos.CreateResponse create(StaffDtos.CreateRequest r) {
    InputRules.optionalPhone(r.phone());
    validateBranchIds(r.branchIds());
    boolean hasAccount = r.hasAccount() == null || r.hasAccount();
    String email = r.email() == null ? "" : r.email().trim().toLowerCase();
    AppUser user =
        hasAccount ? newLogin(email, r.role(), r.password(), r.name(), r.nameEn()) : null;
    Staff p = new Staff();
    p.setName(r.name().trim());
    p.setNameEn(r.nameEn() == null ? "" : r.nameEn().trim());
    p.setPosition(r.position().trim());
    p.setPhone(r.phone() == null ? "" : r.phone().trim());
    p.setEmail(hasAccount ? email : null);
    p.setBranchIds(r.branchIds());
    p.setStatus("ACTIVE");
    p.setAvatarColor(r.avatarColor() == null ? "bg-[#1A4A2E]" : r.avatarColor());
    p.setUserId(user == null ? null : user.getId());
    // A newly added treating staff member participates in commission flows by
    // default. Admins can explicitly turn this off later from Staff & Access.
    p.setCommissionEligible(true);
    p.setCommissionAfterTerminationPolicy("FORFEIT_AFTER_TERMINATION");
    Staff saved = staff.save(p);
    if (user != null) {
      db.update(
          "INSERT INTO user_branches(user_id,branch_id,is_default) SELECT ?, value::bigint,"
              + " row_number() OVER ()=1 FROM jsonb_array_elements_text(?::jsonb) WHERE EXISTS"
              + " (SELECT 1 FROM branches b WHERE b.id=value::bigint AND b.active AND b.deleted_at IS"
              + " NULL)",
          user.getId(),
          r.branchIds());
    }
    return new StaffDtos.CreateResponse(saved.getId(), user == null ? null : user.getId());
  }

  /** Validates and stores a login; the caller links it to the person. */
  private AppUser newLogin(String email, String roleCode, String password, String name, String nameEn) {
    InputRules.require(!email.isBlank(), "An email is required for a login account");
    InputRules.email(email);
    if (users.existsByEmailIgnoreCase(email))
      throw new ResponseStatusException(HttpStatus.CONFLICT, "Email is already in use");
    InputRules.require(isStrongPassword(password),
        "Password must contain upper, lower, number and special character and be at least 12 characters");
    String code = roleCode == null ? "" : roleCode.equals("PHYSIOTHERAPIST") ? "PHYSIO" : roleCode;
    Role role =
        roles
            .findByCode(code)
            .orElseThrow(
                () -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Role not found"));
    AppUser user = new AppUser();
    user.setEmail(email);
    user.setPasswordHash(encoder.encode(password));
    user.setFirstName(name.trim());
    user.setLastName(nameEn == null || nameEn.isBlank() ? "Staff" : nameEn.trim());
    user.setActive(true);
    user.setRoles(Set.of(role));
    return users.save(user);
  }

  /**
   * A person first recorded without a login (a salesperson, say) can be given
   * one later. The account inherits the branches they already work at.
   */
  @Transactional
  public StaffDtos.Row createAccount(long id, StaffDtos.AccountRequest r) {
    Staff person =
        staff
            .findById(id)
            .filter(candidate -> candidate.getDeletedAt() == null)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Staff not found"));
    if (person.getUserId() != null)
      throw new ResponseStatusException(HttpStatus.CONFLICT, "This person already has a login");
    InputRules.require("ACTIVE".equals(person.getStatus()), "Reactivate this person before giving them a login");
    String email = r.email().trim().toLowerCase();
    AppUser user = newLogin(email, r.role(), r.password(), person.getName(), person.getNameEn());
    person.setEmail(email);
    person.setUserId(user.getId());
    staff.save(person);
    db.update(
        "INSERT INTO user_branches(user_id,branch_id,is_default) SELECT ?, value::bigint,"
            + " row_number() OVER ()=1 FROM jsonb_array_elements_text(?::jsonb) WHERE EXISTS"
            + " (SELECT 1 FROM branches b WHERE b.id=value::bigint AND b.active AND b.deleted_at IS"
            + " NULL)",
        user.getId(),
        person.getBranchIds());
    return toRow(person);
  }

  public List<StaffDtos.Row> listActive() {
    return staff.findAllByDeletedAtIsNullOrderByIdAsc().stream()
        .map(this::toRow)
        .collect(Collectors.toList());
  }

  private StaffDtos.Row toRow(Staff person) {
    AppUser user = person.getUserId() == null ? null : users.findById(person.getUserId()).orElse(null);
    String role =
        user == null ? null : user.getRoles().stream().map(Role::getCode).findFirst().orElse(null);
    return new StaffDtos.Row(
        person.getId(),
        person.getName(),
        person.getNameEn(),
        person.getPosition(),
        person.getPhone(),
        person.getEmail(),
        person.getBranchIds(),
        person.getStatus(),
        person.getAvatarColor(),
        person.getUserId(),
        role,
        user != null && user.isActive(),
        person.isCommissionEligible(),
        person.getTerminationDate(),
        person.getCommissionAfterTerminationPolicy());
  }

  /**
   * Editing a profile also re-points the account's branch access, since the
   * branches a therapist works at are the branches they may sign in to.
   */
  @Transactional
  public StaffDtos.Row update(long id, StaffDtos.UpdateRequest r) {
    InputRules.optionalPhone(r.phone());
    validateBranchIds(r.branchIds());
    Staff person =
        staff
            .findById(id)
            .filter(candidate -> candidate.getDeletedAt() == null)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Staff not found"));
    person.setName(r.name().trim());
    person.setNameEn(r.nameEn() == null ? "" : r.nameEn().trim());
    person.setPosition(r.position().trim());
    person.setPhone(r.phone() == null ? "" : r.phone().trim());
    person.setBranchIds(r.branchIds());
    String previousStatus = person.getStatus();
    if (r.status() != null && !r.status().isBlank()) person.setStatus(r.status().trim());
    if (r.avatarColor() != null && !r.avatarColor().isBlank())
      person.setAvatarColor(r.avatarColor());
    if (r.commissionEligible() != null) person.setCommissionEligible(r.commissionEligible());
    if (r.terminationDate() != null) person.setTerminationDate(r.terminationDate());
    if (r.commissionAfterTerminationPolicy() != null && !r.commissionAfterTerminationPolicy().isBlank()) {
      String policy = r.commissionAfterTerminationPolicy().trim();
      InputRules.require(policy.equals("FORFEIT_AFTER_TERMINATION") || policy.equals("CONTINUE_UNTIL_COURSE_END"),
          "Unsupported commission termination policy");
      person.setCommissionAfterTerminationPolicy(policy);
    }
    staff.save(person);

    if (person.getUserId() != null) {
      db.update("DELETE FROM user_branches WHERE user_id=?", person.getUserId());
      db.update(
          "INSERT INTO user_branches(user_id,branch_id,is_default) SELECT ?, value::bigint,"
              + " row_number() OVER ()=1 FROM jsonb_array_elements_text(?::jsonb) WHERE EXISTS"
              + " (SELECT 1 FROM branches b WHERE b.id=value::bigint AND b.deleted_at IS NULL)",
          person.getUserId(),
          r.branchIds());
    }

    // An inactive therapist must not be able to sign in either. The login
    // only follows the status when the status itself changes: a plain profile
    // edit must not quietly hand access back to someone it was taken from.
    boolean statusChanged = !java.util.Objects.equals(previousStatus, person.getStatus());
    AppUser user = person.getUserId() == null ? null : users.findById(person.getUserId()).orElse(null);
    if (user != null && statusChanged) {
      user.setActive("ACTIVE".equals(person.getStatus()));
      users.save(user);
    }
    // Someone no longer on staff keeps nothing of the clinic's schedule in
    // their personal Google account.
    if (statusChanged && !"ACTIVE".equals(person.getStatus()))
      calendarSync.disconnect(id, null, "Staff member set to " + person.getStatus());
    return toRow(person);
  }

  @Transactional
  public void softDelete(long id) {
    Staff person =
        staff
            .findById(id)
            .filter(candidate -> candidate.getDeletedAt() == null)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Staff not found"));
    calendarSync.disconnect(id, null, "Staff member archived");
    OffsetDateTime now = OffsetDateTime.now();
    person.setDeletedAt(now);
    person.setStatus("INACTIVE");
    if (person.getUserId() != null) {
      AppUser user = users.findById(person.getUserId()).orElse(null);
      if (user != null) {
        user.setActive(false);
        user.setDeletedAt(now);
        users.save(user);
      }
    }
    staff.save(person);
  }

  @Transactional
  public void softDeleteByEmail(String email) {
    Staff person =
        staff
            .findFirstByEmailIgnoreCaseAndDeletedAtIsNull(email)
            .orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Staff not found"));
    OffsetDateTime now = OffsetDateTime.now();
    person.setDeletedAt(now);
    AppUser user = users.findByEmailIgnoreCase(email).orElse(null);
    if (user != null) {
      user.setActive(false);
      user.setDeletedAt(now);
      users.save(user);
    }
    staff.save(person);
  }

  private void validateBranchIds(String branchIds) {
    long[] ids;
    try {
      ids = branchIds == null ? null : objectMapper.readValue(branchIds, long[].class);
    } catch (com.fasterxml.jackson.core.JacksonException e) {
      ids = null;
    }
    if (ids == null || ids.length == 0)
      throw new IllegalArgumentException("Branch IDs must be a JSON array of numeric IDs");
    long distinct = java.util.Arrays.stream(ids).distinct().count();
    if (distinct != ids.length) throw new IllegalArgumentException("Branch IDs must not contain duplicates");
    String idList = java.util.stream.LongStream.of(ids)
        .mapToObj(String::valueOf)
        .collect(java.util.stream.Collectors.joining(","));
    Integer active = db.queryForObject(
        "SELECT count(*) FROM branches WHERE id = ANY(?::bigint[]) AND active AND deleted_at IS NULL",
        Integer.class, "{" + idList + "}");
    if (active == null || active != ids.length)
      throw new IllegalArgumentException("Branch IDs must reference active branches");
  }

  private static boolean isStrongPassword(String value) {
    return value != null
        && value.length() >= 12
        && value.length() <= 72
        && value.matches(".*[a-z].*")
        && value.matches(".*[A-Z].*")
        && value.matches(".*\\d.*")
        && value.matches(".*[^A-Za-z\\d].*");
  }
}
