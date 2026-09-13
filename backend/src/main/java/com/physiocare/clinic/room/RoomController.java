package com.physiocare.clinic.room;

import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

/** HTTP adapter for rooms and bookable resources. */
@RestController
@RequestMapping("/api/v1/rooms")
public class RoomController {
  private final RoomService service;
  public RoomController(RoomService service) { this.service = service; }
  @GetMapping public List<Map<String,Object>> list(@RequestParam(required=false) Long branchId) { return service.list(branchId); }
  @PostMapping @ResponseStatus(HttpStatus.CREATED)
  public Map<String,Object> create(@Valid @RequestBody RoomService.RoomRequest r) { return service.create(r); }
  @PatchMapping("/{id}")
  public Map<String,Object> update(@PathVariable long id,@Valid @RequestBody RoomService.RoomRequest r) { return service.update(id,r); }
  @PatchMapping("/{id}/status")
  public Map<String,Object> setStatus(@PathVariable long id,@RequestBody RoomService.ActiveRequest r) { return service.setStatus(id,r); }
}
