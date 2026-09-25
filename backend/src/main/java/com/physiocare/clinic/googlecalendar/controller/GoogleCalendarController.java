package com.physiocare.clinic.googlecalendar.controller;

import com.physiocare.clinic.googlecalendar.model.GoogleCalendarDtos.ConnectResponse;
import com.physiocare.clinic.googlecalendar.model.GoogleCalendarDtos.ConnectionStatusResponse;
import com.physiocare.clinic.googlecalendar.model.GoogleCalendarDtos.StaffConnectionResponse;
import com.physiocare.clinic.googlecalendar.model.GoogleCalendarDtos.SyncResultResponse;
import com.physiocare.clinic.googlecalendar.service.GoogleCalendarConnectionService;
import com.physiocare.clinic.googlecalendar.service.GoogleCalendarSyncService;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/integrations/google-calendar")
public class GoogleCalendarController {
  private final GoogleCalendarConnectionService connections;
  private final GoogleCalendarSyncService sync;

  public GoogleCalendarController(GoogleCalendarConnectionService connections, GoogleCalendarSyncService sync) {
    this.connections = connections;
    this.sync = sync;
  }

  /** The signed-in person's own link. Anyone signed in may see and manage their own. */
  @GetMapping("/status")
  @PreAuthorize("isAuthenticated()")
  public ConnectionStatusResponse status(Authentication authentication) {
    return connections.status(authentication);
  }

  @PostMapping("/connect")
  @PreAuthorize("isAuthenticated()")
  public ConnectResponse connect(Authentication authentication) {
    return connections.startConnect(authentication);
  }

  /**
   * Google redirects the browser here after consent, without the login token;
   * the signed state identifies the person instead. Open in SecurityConfig.
   */
  @GetMapping("/callback")
  public ResponseEntity<Void> callback(
      @RequestParam(required = false) String code,
      @RequestParam(required = false) String state,
      @RequestParam(required = false) String error) {
    return ResponseEntity.status(HttpStatus.FOUND)
        .location(connections.completeConnect(code, state, error))
        .build();
  }

  @DeleteMapping("/connection")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  @PreAuthorize("isAuthenticated()")
  public void disconnect(Authentication authentication) {
    connections.disconnectSelf(authentication);
  }

  /** Admin overview of who has linked a calendar. */
  @GetMapping("/connections")
  @PreAuthorize("@permissionGuard.hasAny(authentication, 'settings.manage')")
  public List<StaffConnectionResponse> listConnections() {
    return connections.listStaffConnections();
  }

  /** Lets an admin unlink someone who has left, or whose link is broken. */
  @DeleteMapping("/connections/{staffId}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  @PreAuthorize("@permissionGuard.hasAny(authentication, 'settings.manage')")
  public void disconnectStaff(@PathVariable long staffId) {
    connections.disconnect(staffId);
  }

  @PostMapping("/appointments/{appointmentId}/sync")
  @PreAuthorize("@permissionGuard.hasAny(authentication, 'appointment.edit')")
  public SyncResultResponse retrySync(@PathVariable long appointmentId, Authentication authentication) {
    return sync.retry(appointmentId, authentication);
  }
}
