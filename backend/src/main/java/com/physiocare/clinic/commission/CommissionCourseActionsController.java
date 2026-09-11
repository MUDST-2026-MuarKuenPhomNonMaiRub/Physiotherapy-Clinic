package com.physiocare.clinic.commission;

import com.physiocare.clinic.common.BranchAccessService;
import com.physiocare.clinic.common.CurrentUser;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
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

  public record AddMemberRequest(@Positive long patientId, @Positive int visitsFromOwner) {}

  public record RefundRemainingRequest(@Positive int visits, @NotBlank String reason) {}

  @GetMapping("/members")
  public List<Map<String, Object>> members(@PathVariable long id, Authentication authentication) {
    branches.requireCourseAccess(authentication, id);
    return sharedCourse.listMembers(id);
  }

  @PostMapping("/members")
  @ResponseStatus(HttpStatus.CREATED)
  @PreAuthorize("hasAnyRole('ADMIN','FINANCE','RECEPTIONIST')")
  public void addMember(
      @PathVariable long id, @RequestBody AddMemberRequest request, Authentication authentication) {
    branches.requireCourseAccess(authentication, id);
    sharedCourse.addMember(id, request.patientId(), request.visitsFromOwner());
  }

  @DeleteMapping("/members/{patientId}")
  @PreAuthorize("hasAnyRole('ADMIN','FINANCE','RECEPTIONIST')")
  public void removeMember(
      @PathVariable long id, @PathVariable long patientId, Authentication authentication) {
    branches.requireCourseAccess(authentication, id);
    sharedCourse.removeMember(id, patientId);
  }

  @PostMapping("/refund-remaining")
  @PreAuthorize("hasAnyRole('ADMIN','FINANCE')")
  public void refundRemaining(
      @PathVariable long id, @RequestBody RefundRemainingRequest request, Authentication authentication) {
    branches.requireCourseAccess(authentication, id);
    adjustments.refundRemainingVisits(
        id,
        request.visits(),
        branches.branchIdOf(id),
        currentUser.id(authentication),
        currentUser.displayName(authentication),
        request.reason());
  }
}
