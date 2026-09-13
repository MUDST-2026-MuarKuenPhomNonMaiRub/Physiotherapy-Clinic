package com.physiocare.clinic.checkout;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Positive;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

/** HTTP adapter for course transfers. */
@RestController
@RequestMapping("/api/v1/course-transfers")
public class CourseTransferController {
  private final CourseTransferService service;
  public CourseTransferController(CourseTransferService service) { this.service = service; }

  public record TransferRequest(@Positive long patientCourseId, @Positive long toPatientId,
      @Positive int sessions, String reason) {}

  @GetMapping
  public List<Map<String, Object>> list(@RequestParam(required = false) Long branchId,
      Authentication authentication) {
    return service.list(branchId, authentication);
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  @PreAuthorize("@permissionGuard.hasAny(authentication, 'course.transfer')")
  public Map<String, Object> transfer(@Valid @RequestBody TransferRequest r,
      Authentication authentication) {
    return service.transfer(new CourseTransferService.TransferRequest(r.patientCourseId(),
        r.toPatientId(), r.sessions(), r.reason()), authentication);
  }
}
