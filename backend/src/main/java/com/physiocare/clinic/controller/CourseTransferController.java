package com.physiocare.clinic.controller;

import com.physiocare.clinic.dto.checkout.CourseTransferDtos.TransferRequest;
import com.physiocare.clinic.service.CourseTransferService;
import jakarta.validation.Valid;
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

  @GetMapping
  @PreAuthorize("@permissionGuard.hasAny(authentication, 'course.transfer')")
  public List<Map<String, Object>> list(@RequestParam(required = false) Long branchId,
      Authentication authentication) {
    return service.list(branchId, authentication);
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  @PreAuthorize("@permissionGuard.hasAny(authentication, 'course.transfer')")
  public Map<String, Object> transfer(@Valid @RequestBody TransferRequest r,
      Authentication authentication) {
    return service.transfer(r, authentication);
  }
}
