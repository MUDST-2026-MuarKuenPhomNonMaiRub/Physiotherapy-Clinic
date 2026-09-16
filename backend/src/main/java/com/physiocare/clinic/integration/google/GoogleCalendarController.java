package com.physiocare.clinic.integration.google;

import com.physiocare.clinic.auth.PermissionGuard;
import com.physiocare.clinic.common.BranchAccessService;
import com.physiocare.clinic.common.CurrentUser;
import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

/**
 * Connecting a Google account is personal — it is that person's own Google
 * login — so only the signed-in user may start one for their own staff
 * record. Seeing the state or cutting a connection is also open to an
 * administrator.
 */
@RestController
@RequestMapping("/api/v1/integrations/google")
public class GoogleCalendarController {
  private final GoogleCalendarConnectionService connections;
  private final GoogleCalendarSyncService sync;
  private final CurrentUser currentUser;
  private final PermissionGuard guard;
  private final BranchAccessService branches;
  private final JdbcTemplate db;

  public GoogleCalendarController(
      GoogleCalendarConnectionService connections,
      GoogleCalendarSyncService sync,
      CurrentUser currentUser,
      PermissionGuard guard,
      BranchAccessService branches,
      JdbcTemplate db) {
    this.connections = connections;
    this.sync = sync;
    this.currentUser = currentUser;
    this.guard = guard;
    this.branches = branches;
    this.db = db;
  }

  @GetMapping("/status")
  public Map<String, Object> status(
      @RequestParam(required = false) Long staffId, Authentication authentication) {
    long target = resolveStaff(staffId, authentication);
    GoogleCalendarConnectionService.Status status = connections.status(target);
    Map<String, Object> body = new HashMap<>();
    body.put("staffId", target);
    body.put("configured", status.configured());
    body.put("connected", status.connected());
    body.put("googleEmail", status.googleEmail());
    body.put("connectedAt", status.connectedAt() == null ? null : status.connectedAt().toString());
    body.put("lastError", status.lastError());
    body.put("lastErrorAt", status.lastErrorAt() == null ? null : status.lastErrorAt().toString());
    body.put("pending", pendingCount(target));
    return body;
  }

  /** Every connected staff member, for the administration screen. */
  @GetMapping("/connections")
  @PreAuthorize("@permissionGuard.hasAny(authentication, 'settings.manage')")
  public java.util.List<Map<String, Object>> connections() {
    return db.queryForList(
        "SELECT c.staff_id, c.google_email, c.connected_at, c.last_error, c.last_error_at,"
            + " (SELECT count(*) FROM appointment_calendar_events e WHERE e.staff_id=c.staff_id AND"
            + " e.sync_status IN ('PENDING','FAILED')) AS pending FROM staff_google_calendars c"
            + " ORDER BY c.staff_id");
  }

  /** The Google consent URL for the signed-in person's own calendar; the browser is sent there. */
  @PostMapping("/connect")
  public Map<String, String> connect(Authentication authentication) {
    Long staffId = currentUser.staffId(authentication);
    if (staffId == null)
      throw new IllegalArgumentException(
          "This login has no staff profile, so there is no calendar to connect");
    return Map.of("url", connections.authorizationUrl(staffId, currentUser.id(authentication)));
  }

  /**
   * Google sends the browser here. It arrives without the app's token, so
   * the endpoint is open; the one-time state is what proves who started it.
   * Whatever happens, the person ends up back in the app with the outcome
   * in the query string.
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
  public void disconnect(@RequestParam(required = false) Long staffId, Authentication authentication) {
    long target = resolveStaff(staffId, authentication);
    sync.disconnect(target, currentUser.id(authentication), "Disconnected from Staff & Access");
  }

  @GetMapping("/appointments/{id}")
  @PreAuthorize("@permissionGuard.hasAny(authentication, 'appointment.view')")
  public ResponseEntity<Map<String, Object>> appointmentSync(
      @PathVariable long id, Authentication authentication) {
    requireAppointmentAccess(id, authentication);
    Map<String, Object> status = sync.syncStatus(id);
    return status == null ? ResponseEntity.noContent().build() : ResponseEntity.ok(status);
  }

  @PostMapping("/appointments/{id}/retry")
  @PreAuthorize("@permissionGuard.hasAny(authentication, 'appointment.edit')")
  public void retry(@PathVariable long id, Authentication authentication) {
    requireAppointmentAccess(id, authentication);
    sync.retry(id);
  }

  /** Own staff record by default; someone else's only with settings.manage. */
  private long resolveStaff(Long requested, Authentication authentication) {
    Long own = currentUser.staffId(authentication);
    if (requested == null) {
      if (own == null)
        throw new IllegalArgumentException("This login has no staff profile");
      return own;
    }
    if (own != null && own.equals(requested)) return requested;
    if (!guard.hasAny(authentication, "settings.manage"))
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You may only manage your own calendar connection");
    return requested;
  }

  private void requireAppointmentAccess(long appointmentId, Authentication authentication) {
    Long branchId =
        db.queryForList("SELECT branch_id FROM appointments WHERE id=?", Long.class, appointmentId)
            .stream()
            .findFirst()
            .orElseThrow(() -> new IllegalArgumentException("Appointment not found"));
    branches.requireAccess(authentication, branchId);
  }

  private int pendingCount(long staffId) {
    Integer count =
        db.queryForObject(
            "SELECT count(*) FROM appointment_calendar_events WHERE staff_id=? AND sync_status IN"
                + " ('PENDING','FAILED')",
            Integer.class, staffId);
    return count == null ? 0 : count;
  }

  private static String encode(String value) {
    return URLEncoder.encode(value, StandardCharsets.UTF_8);
  }
}
