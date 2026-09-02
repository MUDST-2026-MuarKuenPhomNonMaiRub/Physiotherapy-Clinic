package com.physiocare.clinic.branch;

import jakarta.validation.Valid;
import java.util.List;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping({"/api/v1/branches", "/api/branches"})
public class BranchController {
  private static final RowMapper<Branch> MAPPER =
      (rs, row) ->
          new Branch(
              rs.getLong("id"),
              rs.getString("code"),
              rs.getString("name"),
              rs.getString("phone"),
              rs.getString("address"),
              rs.getBoolean("active"));

  private final JdbcTemplate db;

  public BranchController(JdbcTemplate db) {
    this.db = db;
  }

  @GetMapping
  public List<Branch> list() {
    return db.query(
        "SELECT id,code,name,phone,address,active FROM branches WHERE deleted_at IS NULL ORDER BY"
            + " id",
        MAPPER);
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  @PreAuthorize("hasRole('ADMIN')")
  public Branch create(@Valid @RequestBody BranchRequest r) {
    long id;
    try {
      id =
          db.queryForObject(
              "INSERT INTO branches(code,name,phone,address,active) VALUES(?,?,?,?,?) RETURNING id",
              Long.class,
              r.code().trim().toUpperCase(),
              r.name(),
              r.phone(),
              r.address(),
              r.active());
    } catch (DuplicateKeyException e) {
      throw new IllegalArgumentException("A branch with this code already exists");
    }
    return get(id);
  }

  @PatchMapping("/{id}")
  @PreAuthorize("hasRole('ADMIN')")
  public Branch update(@PathVariable long id, @Valid @RequestBody BranchRequest r) {
    int rows;
    try {
      rows =
          db.update(
              "UPDATE branches SET code=?,name=?,phone=?,address=?,active=?,updated_at=now() WHERE"
                  + " id=? AND deleted_at IS NULL",
              r.code().trim().toUpperCase(),
              r.name(),
              r.phone(),
              r.address(),
              r.active(),
              id);
    } catch (DuplicateKeyException e) {
      throw new IllegalArgumentException("A branch with this code already exists");
    }
    if (rows == 0) throw new IllegalArgumentException("Branch not found");
    return get(id);
  }

  @PatchMapping("/{id}/status")
  @PreAuthorize("hasRole('ADMIN')")
  public Branch updateStatus(@PathVariable long id, @RequestBody StatusRequest r) {
    int rows =
        db.update(
            "UPDATE branches SET active=?,updated_at=now() WHERE id=? AND deleted_at IS NULL",
            r.active(),
            id);
    if (rows == 0) throw new IllegalArgumentException("Branch not found");
    return get(id);
  }

  private Branch get(long id) {
    return db.queryForObject(
        "SELECT id,code,name,phone,address,active FROM branches WHERE id=?", MAPPER, id);
  }

  public record StatusRequest(boolean active) {}
}
