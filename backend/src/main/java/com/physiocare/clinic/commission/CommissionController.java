package com.physiocare.clinic.commission;

import com.physiocare.clinic.common.BranchAccessService;
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

  public CommissionController(CommissionService service, BranchAccessService access) {
    this.service = service;
    this.access = access;
  }

  @PostMapping("/courses")
  @ResponseStatus(HttpStatus.CREATED)
  @PreAuthorize("hasAnyRole('ADMIN','FINANCE','RECEPTIONIST')")
  public void createCourse(@Valid @RequestBody CommissionDtos.CreateCourseRequest request) {
    service.createCourse(request);
  }

  @PostMapping("/close")
  @PreAuthorize("hasAnyRole('ADMIN','FINANCE')")
  public String close(@Valid @RequestBody CommissionDtos.CloseMonthRequest request) {
    return "Closed employees: " + service.closeMonth(request.month());
  }

  @PostMapping("/courses/{id}/use")
  @PreAuthorize("hasAnyRole('ADMIN','FINANCE','RECEPTIONIST','PHYSIO')")
  public CommissionDtos.CourseView use(
      @PathVariable long id,
      @Valid @RequestBody CommissionDtos.UseCourseRequest request,
      Authentication authentication) {
    access.requireCourseAccess(authentication, id);
    return service.useCourse(id, request);
  }

  @PostMapping("/courses/{id}/transfer")
  @PreAuthorize("hasAnyRole('ADMIN','FINANCE','RECEPTIONIST')")
  public CommissionDtos.CourseView transfer(
      @PathVariable long id,
      @Valid @RequestBody CommissionDtos.TransferRequest request,
      Authentication authentication) {
    access.requireCourseAccess(authentication, id);
    return service.transfer(id, request);
  }

  @GetMapping("/courses/{id}")
  public CommissionDtos.CourseView get(@PathVariable long id, Authentication authentication) {
    access.requireCourseAccess(authentication, id);
    return service.getCourse(id);
  }
}
