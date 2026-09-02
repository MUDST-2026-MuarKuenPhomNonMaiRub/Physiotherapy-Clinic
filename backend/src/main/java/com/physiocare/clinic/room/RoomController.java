package com.physiocare.clinic.room;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

/** Treatment rooms and other bookable resources, configured per branch. */
@RestController
@RequestMapping("/api/v1/rooms")
public class RoomController {
  private final JdbcTemplate db;

  public RoomController(JdbcTemplate db) {
    this.db = db;
  }

  public record RoomRequest(
      @NotBlank String name, @NotBlank String roomType, @Positive long branchId, Boolean active) {}

  public record ActiveRequest(boolean active) {}

  @GetMapping
  public List<Map<String, Object>> list(@RequestParam(required = false) Long branchId) {
    return db.queryForList(
        "SELECT id,branch_id,code,name,room_type,active FROM rooms WHERE (?::bigint IS NULL OR branch_id=?)"
            + " ORDER BY branch_id,id",
        branchId,
        branchId);
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  @PreAuthorize("hasRole('ADMIN')")
  public Map<String, Object> create(@Valid @RequestBody RoomRequest r) {
    long id =
        db.queryForObject(
            "INSERT INTO rooms(branch_id,code,name,room_type,active) VALUES(?,?,?,?,?) RETURNING"
                + " id",
            Long.class,
            r.branchId(),
            nextCode(r.branchId()),
            r.name(),
            r.roomType(),
            r.active() == null || r.active());
    return room(id);
  }

  @PatchMapping("/{id}")
  @PreAuthorize("hasRole('ADMIN')")
  public Map<String, Object> update(@PathVariable long id, @Valid @RequestBody RoomRequest r) {
    int rows =
        db.update(
            "UPDATE rooms SET name=?,room_type=?,branch_id=?,active=COALESCE(?,active) WHERE id=?",
            r.name(),
            r.roomType(),
            r.branchId(),
            r.active(),
            id);
    if (rows == 0) throw new IllegalArgumentException("Room not found");
    return room(id);
  }

  @PatchMapping("/{id}/status")
  @PreAuthorize("hasRole('ADMIN')")
  public Map<String, Object> setStatus(@PathVariable long id, @RequestBody ActiveRequest r) {
    int rows = db.update("UPDATE rooms SET active=? WHERE id=?", r.active(), id);
    if (rows == 0) throw new IllegalArgumentException("Room not found");
    return room(id);
  }

  private Map<String, Object> room(long id) {
    return db.queryForMap("SELECT id,branch_id,code,name,room_type,active FROM rooms WHERE id=?", id);
  }

  /** Room codes are unique per branch only, so the sequence restarts at each branch. */
  private String nextCode(long branchId) {
    Integer next =
        db.queryForObject(
            "SELECT count(*)+1 FROM rooms WHERE branch_id=?", Integer.class, branchId);
    String candidate = String.format("R%03d", next);
    while (Boolean.TRUE.equals(
        db.queryForObject(
            "SELECT EXISTS(SELECT 1 FROM rooms WHERE branch_id=? AND code=?)",
            Boolean.class,
            branchId,
            candidate))) {
      next++;
      candidate = String.format("R%03d", next);
    }
    return candidate;
  }
}
