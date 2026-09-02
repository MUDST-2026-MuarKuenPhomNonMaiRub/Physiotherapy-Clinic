package com.physiocare.clinic.staff;

import com.physiocare.clinic.auth.*;
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

  public StaffService(
      StaffRepository s,
      AppUserRepository u,
      RoleRepository r,
      PasswordEncoder e,
      JdbcTemplate db) {
    staff = s;
    users = u;
    roles = r;
    encoder = e;
    this.db = db;
  }

  @Transactional
  public StaffDtos.CreateResponse create(StaffDtos.CreateRequest r) {
    String email = r.email().trim().toLowerCase();
    if (users.existsByEmailIgnoreCase(email))
      throw new ResponseStatusException(HttpStatus.CONFLICT, "Email is already in use");
    String code = r.role().equals("PHYSIOTHERAPIST") ? "PHYSIO" : r.role();
    Role role =
        roles
            .findByCode(code)
            .orElseThrow(
                () -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Role not found"));
    AppUser user = new AppUser();
    user.setEmail(email);
    user.setPasswordHash(encoder.encode(r.password()));
    user.setFirstName(r.name().trim());
    user.setLastName(r.nameEn() == null || r.nameEn().isBlank() ? "Staff" : r.nameEn().trim());
    user.setActive(true);
    user.setRoles(Set.of(role));
    users.save(user);
    Staff p = new Staff();
    p.setName(r.name().trim());
    p.setNameEn(r.nameEn() == null ? "" : r.nameEn().trim());
    p.setPosition(r.position().trim());
    p.setPhone(r.phone() == null ? "" : r.phone().trim());
    p.setEmail(email);
    p.setBranchIds(r.branchIds());
    p.setStatus("ACTIVE");
    p.setAvatarColor(r.avatarColor() == null ? "bg-[#1A4A2E]" : r.avatarColor());
    p.setUserId(user.getId());
    Staff saved = staff.save(p);
    db.update(
        "INSERT INTO user_branches(user_id,branch_id,is_default) SELECT ?, value::bigint,"
            + " row_number() OVER ()=1 FROM jsonb_array_elements_text(?::jsonb) WHERE EXISTS"
            + " (SELECT 1 FROM branches b WHERE b.id=value::bigint AND b.active AND b.deleted_at IS"
            + " NULL)",
        user.getId(),
        r.branchIds());
    return new StaffDtos.CreateResponse(saved.getId(), user.getId());
  }

  public List<StaffDtos.Row> listActive() {
    return staff.findAllByDeletedAtIsNullOrderByIdAsc().stream()
        .map(this::toRow)
        .collect(Collectors.toList());
  }

  private StaffDtos.Row toRow(Staff person) {
    AppUser user = users.findById(person.getUserId()).orElse(null);
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
        user != null && user.isActive());
  }

  /**
   * Editing a profile also re-points the account's branch access, since the
   * branches a therapist works at are the branches they may sign in to.
   */
  @Transactional
  public StaffDtos.Row update(long id, StaffDtos.UpdateRequest r) {
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
    if (r.status() != null && !r.status().isBlank()) person.setStatus(r.status().trim());
    if (r.avatarColor() != null && !r.avatarColor().isBlank())
      person.setAvatarColor(r.avatarColor());
    staff.save(person);

    db.update("DELETE FROM user_branches WHERE user_id=?", person.getUserId());
    db.update(
        "INSERT INTO user_branches(user_id,branch_id,is_default) SELECT ?, value::bigint,"
            + " row_number() OVER ()=1 FROM jsonb_array_elements_text(?::jsonb) WHERE EXISTS"
            + " (SELECT 1 FROM branches b WHERE b.id=value::bigint AND b.deleted_at IS NULL)",
        person.getUserId(),
        r.branchIds());

    // An inactive therapist must not be able to sign in either.
    AppUser user = users.findById(person.getUserId()).orElse(null);
    if (user != null) {
      user.setActive("ACTIVE".equals(person.getStatus()));
      users.save(user);
    }
    return toRow(person);
  }

  @Transactional
  public void softDelete(long id) {
    Staff person =
        staff
            .findById(id)
            .filter(candidate -> candidate.getDeletedAt() == null)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Staff not found"));
    softDeleteByEmail(person.getEmail());
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
}
