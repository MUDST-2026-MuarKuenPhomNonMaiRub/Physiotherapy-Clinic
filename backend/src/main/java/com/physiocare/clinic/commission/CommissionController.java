package com.physiocare.clinic.commission;

import com.physiocare.clinic.common.BranchAccessService;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/commission")
public class CommissionController {
  private final CommissionService service;
  private final BranchAccessService access;
  private final CommissionQueryService queries;

  public CommissionController(
      CommissionService service, BranchAccessService access, CommissionQueryService queries) {
    this.service = service;
    this.access = access;
    this.queries = queries;
  }

  @PostMapping("/courses")
  @ResponseStatus(HttpStatus.CREATED)
  @PreAuthorize("hasAnyRole('ADMIN','FINANCE','RECEPTIONIST')")
  public void createCourse(@Valid @RequestBody CommissionDtos.CreateCourseRequest request) {
    service.createCourse(request);
  }

  @GetMapping("/courses/{id}")
  public CommissionDtos.CourseView get(@PathVariable long id, Authentication authentication) {
    access.requireCourseAccess(authentication, id);
    return service.getCourse(id);
  }

  @GetMapping("/ledger-records")
  @PreAuthorize("hasAnyRole('ADMIN','PHYSIO','FINANCE','REPORT_VIEWER')")
  public List<Map<String, Object>> ledgerRecords(
      @RequestParam LocalDate from,
      @RequestParam LocalDate to,
      @RequestParam(required = false) Long branchId,
      @RequestParam(required = false) Long staffId,
      Authentication authentication) {
    access.requireFilter(authentication, branchId);
    return queries.ledgerRecords(from, to, branchId, staffId, authentication);
  }
}
