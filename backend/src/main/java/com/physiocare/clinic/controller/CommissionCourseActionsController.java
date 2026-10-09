package com.physiocare.clinic.controller;

import com.physiocare.clinic.dto.commission.CommissionCourseActionDtos.AddMemberRequest;
import com.physiocare.clinic.dto.commission.CommissionCourseActionDtos.RefundRemainingRequest;
import com.physiocare.clinic.service.CommissionAdjustmentService;
import com.physiocare.clinic.service.SharedCourseService;

import com.physiocare.clinic.security.BranchAccessService;
import com.physiocare.clinic.security.CurrentUser;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

/** Shared-course membership and the "refund the unused remainder" action on an existing course. */
@RestController
@RequestMapping("/api/v1/commission/courses/{id}")
public class CommissionCourseActionsController {
  private final SharedCourseService sharedCourse;
  private final CommissionAdjustmentService adjustments;
  private final BranchAccessService branches;
  private final CurrentUser currentUser;

  public CommissionCourseActionsController(
      SharedCourseService sharedCourse,
      CommissionAdjustmentService adjustments,
      BranchAccessService branches,
      CurrentUser currentUser) {
    this.sharedCourse = sharedCourse;
    this.adjustments = adjustments;
    this.branches = branches;
    this.currentUser = currentUser;
  }

  @GetMapping("/members")
  @PreAuthorize("@permissionGuard.hasAny(authentication, 'course.view')")
  public List<Map<String, Object>> members(@PathVariable long id, Authentication authentication) {
    branches.requireCourseAccess(authentication, id);
    return sharedCourse.listMembers(id);
  }

  @PostMapping("/members")
  @ResponseStatus(HttpStatus.CREATED)
  @PreAuthorize("@permissionGuard.hasAny(authentication, 'course.share')")
  public void addMember(
      @PathVariable long id, @RequestBody AddMemberRequest request, Authentication authentication) {
    branches.requireCourseAccess(authentication, id);
    sharedCourse.addMember(id, request.patientId(), request.visitsFromOwner(),
        currentUser.id(authentication), "Shared course member added");
  }

  @DeleteMapping("/members/{patientId}")
  @PreAuthorize("@permissionGuard.hasAny(authentication, 'course.share')")
  public void removeMember(
      @PathVariable long id, @PathVariable long patientId, Authentication authentication) {
    branches.requireCourseAccess(authentication, id);
    sharedCourse.removeMember(id, patientId, currentUser.id(authentication), "Shared course member removed");
  }

  @PostMapping("/refund-remaining")
  @PreAuthorize("@permissionGuard.hasAny(authentication, 'commission.adjust')")
  public void refundRemaining(
      @PathVariable long id, @RequestBody RefundRemainingRequest request, Authentication authentication) {
    branches.requireCourseAccess(authentication, id);
    adjustments.refundRemainingVisits(
        id,
        request.memberPatientId(),
        request.visits(),
        branches.branchIdOf(id),
        currentUser.id(authentication),
        currentUser.displayName(authentication),
        request.reason());
  }
}
