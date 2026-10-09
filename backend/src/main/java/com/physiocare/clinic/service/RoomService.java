package com.physiocare.clinic.service;

import com.physiocare.clinic.dto.room.RoomDtos.ActiveRequest;
import com.physiocare.clinic.dto.room.RoomDtos.RoomRequest;
import com.physiocare.clinic.security.BranchAccessService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.web.bind.annotation.*;

/** Treatment rooms and other bookable resources, configured per branch. */
@Service
public class RoomService {
  private final JdbcTemplate db;
  private final BranchAccessService branches;
  private final GoogleCalendarSyncService calendarSync;

  public RoomService(JdbcTemplate db, BranchAccessService branches, GoogleCalendarSyncService calendarSync) {
    this.db = db;
    this.branches = branches;
    this.calendarSync = calendarSync;
  }

  @GetMapping
  public List<Map<String, Object>> list(@RequestParam(required = false) Long branchId, Authentication authentication) {
    branches.requireFilter(authentication, branchId);
    return db.queryForList(
        "SELECT id,branch_id,code,name,room_type,active FROM rooms WHERE (?::bigint IS NULL OR branch_id=?)"
            + " ORDER BY branch_id,id",
        branchId,
        branchId);
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  @PreAuthorize("@permissionGuard.hasAny(authentication, 'settings.manage')")
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
  @PreAuthorize("@permissionGuard.hasAny(authentication, 'settings.manage')")
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
    // Upcoming calendar events show the room name.
    calendarSync.detailChanged(GoogleCalendarSyncService.EventDetail.ROOM, id);
    return room(id);
  }

  @PatchMapping("/{id}/status")
  @PreAuthorize("@permissionGuard.hasAny(authentication, 'settings.manage')")
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
