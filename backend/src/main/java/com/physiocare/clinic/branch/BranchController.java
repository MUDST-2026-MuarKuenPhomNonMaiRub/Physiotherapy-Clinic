package com.physiocare.clinic.branch;

import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/branches")
public class BranchController {
  private final JdbcTemplate db;

  public BranchController(JdbcTemplate db) {
    this.db = db;
  }

  @GetMapping
  public List<Branch> list() {
    return db.query(
        "SELECT id,code,name,phone,address,active FROM branches WHERE deleted_at IS NULL ORDER BY"
            + " id",
        (rs, row) ->
            new Branch(
                rs.getLong("id"),
                rs.getString("code"),
                rs.getString("name"),
                rs.getString("phone"),
                rs.getString("address"),
                rs.getBoolean("active")));
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  @PreAuthorize("hasRole('ADMIN')")
  public Branch create(@Valid @RequestBody BranchRequest r) {
    long id =
        db.queryForObject(
            "INSERT INTO branches(code,name,phone,address,active) VALUES(?,?,?,?,?) RETURNING id",
            Long.class,
            r.code().trim().toUpperCase(),
            r.name(),
            r.phone(),
            r.address(),
            r.active());
    return db.queryForObject(
        "SELECT id,code,name,phone,address,active FROM branches WHERE id=?",
        (rs, row) ->
            new Branch(
                rs.getLong(1),
                rs.getString(2),
                rs.getString(3),
                rs.getString(4),
                rs.getString(5),
                rs.getBoolean(6)),
        id);
  }

  @PatchMapping("/{id}/status")
  @PreAuthorize("hasRole('ADMIN')")
  public Branch updateStatus(@PathVariable long id, @RequestBody StatusRequest r) {
    db.update(
        "UPDATE branches SET active=?,updated_at=now() WHERE id=? AND deleted_at IS NULL",
        r.active(),
        id);
    return db.queryForObject(
        "SELECT id,code,name,phone,address,active FROM branches WHERE id=? AND deleted_at IS NULL",
        (rs, row) ->
            new Branch(
                rs.getLong(1),
                rs.getString(2),
                rs.getString(3),
                rs.getString(4),
                rs.getString(5),
                rs.getBoolean(6)),
        id);
  }

  public record StatusRequest(boolean active) {}
}
