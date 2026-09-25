package com.physiocare.clinic.integration.google.service;

import com.physiocare.clinic.auth.PermissionGuard;
import com.physiocare.clinic.common.BranchAccessService;
import com.physiocare.clinic.common.CurrentUser;
import com.physiocare.clinic.integration.google.repository.AppointmentCalendarRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

/**
 * Who may act on which calendar link. Connecting is personal — it is that
 * person's own Google login — so only the signed-in user may start one for
 * their own staff record; seeing the state or cutting a connection is also
 * open to an administrator.
 */
@Service
public class GoogleCalendarAccessService {
  private final CurrentUser currentUser;
  private final PermissionGuard guard;
  private final BranchAccessService branches;
  private final AppointmentCalendarRepository appointments;

  public GoogleCalendarAccessService(
      CurrentUser currentUser,
      PermissionGuard guard,
      BranchAccessService branches,
      AppointmentCalendarRepository appointments) {
    this.currentUser = currentUser;
    this.guard = guard;
    this.branches = branches;
    this.appointments = appointments;
  }

  /** The caller's own staff record; a login without one has no calendar to connect. */
  public long ownStaffId(Authentication authentication) {
    Long staffId = currentUser.staffId(authentication);
    if (staffId == null)
      throw new IllegalArgumentException("This login has no staff profile, so there is no calendar to connect");
    return staffId;
  }

  public Long userId(Authentication authentication) {
    return currentUser.id(authentication);
  }

  /** Own staff record by default; someone else's only with settings.manage. */
  public long resolveStaff(Long requested, Authentication authentication) {
    Long own = currentUser.staffId(authentication);
    if (requested == null) {
      if (own == null) throw new IllegalArgumentException("This login has no staff profile");
      return own;
    }
    if (own != null && own.equals(requested)) return requested;
    if (!guard.hasAny(authentication, "settings.manage"))
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You may only manage your own calendar connection");
    return requested;
  }

  public void requireAppointmentAccess(long appointmentId, Authentication authentication) {
    long branchId = appointments.findBranchId(appointmentId)
        .orElseThrow(() -> new IllegalArgumentException("Appointment not found"));
    branches.requireAccess(authentication, branchId);
  }
}
