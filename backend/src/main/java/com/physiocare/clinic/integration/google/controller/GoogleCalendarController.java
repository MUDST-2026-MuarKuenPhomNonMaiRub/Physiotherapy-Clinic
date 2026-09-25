package com.physiocare.clinic.integration.google.controller;

import com.physiocare.clinic.integration.google.model.ConnectionStatus;
import com.physiocare.clinic.integration.google.model.GoogleCalendarDtos.ConnectResponse;
import com.physiocare.clinic.integration.google.model.GoogleCalendarDtos.ConnectionRow;
import com.physiocare.clinic.integration.google.model.GoogleCalendarDtos.StatusResponse;
import com.physiocare.clinic.integration.google.model.GoogleCalendarDtos.SyncStatusResponse;
import com.physiocare.clinic.integration.google.service.GoogleCalendarAccessService;
import com.physiocare.clinic.integration.google.service.GoogleCalendarConnectionService;
import com.physiocare.clinic.integration.google.service.GoogleCalendarSyncService;
import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

/** HTTP for the Google Calendar push. Rules live in the services; this class only maps requests. */
@RestController
@RequestMapping("/api/v1/integrations/google")
public class GoogleCalendarController {
  private final GoogleCalendarConnectionService connections;
  private final GoogleCalendarSyncService sync;
  private final GoogleCalendarAccessService access;

  public GoogleCalendarController(
      GoogleCalendarConnectionService connections,
      GoogleCalendarSyncService sync,
      GoogleCalendarAccessService access) {
    this.connections = connections;
    this.sync = sync;
    this.access = access;
  }

  @GetMapping("/status")
  @PreAuthorize("isAuthenticated()")
  public StatusResponse status(
      @RequestParam(required = false) Long staffId, Authentication authentication) {
    long target = access.resolveStaff(staffId, authentication);
    ConnectionStatus status = connections.status(target);
    return new StatusResponse(
        target,
        status.configured(),
        status.connected(),
        status.googleEmail(),
        status.connectedAt() == null ? null : status.connectedAt().toString(),
        status.lastError(),
        status.lastErrorAt() == null ? null : status.lastErrorAt().toString(),
        sync.outstanding(target));
  }

  /** Every connected staff member, for the administration screens. */
  @GetMapping("/connections")
  @PreAuthorize("@permissionGuard.hasAny(authentication, 'settings.manage')")
  public List<ConnectionRow> connections() {
    return connections.listConnections();
  }

  /** The Google consent URL for the signed-in person's own calendar; the browser is sent there. */
  @PostMapping("/connect")
  @PreAuthorize("isAuthenticated()")
  public ConnectResponse connect(Authentication authentication) {
    long staffId = access.ownStaffId(authentication);
    return new ConnectResponse(connections.authorizationUrl(staffId, access.userId(authentication)));
  }

  /**
   * Google sends the browser here. It arrives without the app's token, so
   * the endpoint is open (see SecurityConfig); the one-time state is what
   * proves who started it. Whatever happens, the person ends up back in the
   * app with the outcome in the query string.
   */
  @GetMapping("/callback")
  public ResponseEntity<Void> callback(
      @RequestParam(required = false) String state,
      @RequestParam(required = false) String code,
      @RequestParam(required = false) String error) {
    String outcome;
    if (error != null || code == null || state == null) {
      outcome = "error&message=" + encode(error == null ? "Google did not return an authorisation code" : error);
    } else {
      try {
        long staffId = connections.completeConnection(state, code);
        int queued = sync.backfill(staffId);
        outcome = "connected&queued=" + queued;
      } catch (RuntimeException e) {
        outcome = "error&message=" + encode(e.getMessage() == null ? "Connection failed" : e.getMessage());
      }
    }
    return ResponseEntity.status(HttpStatus.FOUND)
        .location(URI.create(connections.frontendUrl() + "/calendar?google=" + outcome))
        .build();
  }

  @DeleteMapping("/connection")
  @PreAuthorize("isAuthenticated()")
  public void disconnect(@RequestParam(required = false) Long staffId, Authentication authentication) {
    long target = access.resolveStaff(staffId, authentication);
    sync.disconnect(target, access.userId(authentication), "Disconnected from Staff & Access");
  }

  @GetMapping("/appointments/{id}")
  @PreAuthorize("@permissionGuard.hasAny(authentication, 'appointment.view')")
  public ResponseEntity<SyncStatusResponse> appointmentSync(
      @PathVariable long id, Authentication authentication) {
    access.requireAppointmentAccess(id, authentication);
    return sync.syncStatus(id).map(ResponseEntity::ok).orElse(ResponseEntity.noContent().build());
  }

  @PostMapping("/appointments/{id}/retry")
  @PreAuthorize("@permissionGuard.hasAny(authentication, 'appointment.edit')")
  public void retry(@PathVariable long id, Authentication authentication) {
    access.requireAppointmentAccess(id, authentication);
    sync.retry(id);
  }

  private static String encode(String value) {
    return URLEncoder.encode(value, StandardCharsets.UTF_8);
  }
}
