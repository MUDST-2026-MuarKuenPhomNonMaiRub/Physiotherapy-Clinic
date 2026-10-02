package com.physiocare.clinic.notification;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

/**
 * The header bell. Every signed-in user may read their own notifications;
 * what each one contains is limited by their permissions in the service.
 */
@RestController
@RequestMapping("/api/v1/notifications")
public class NotificationController {
  private final NotificationService service;

  public NotificationController(NotificationService service) {
    this.service = service;
  }

  public record ReadRequest(@NotNull @Size(max = 100) List<String> keys) {}

  @GetMapping
  @PreAuthorize("isAuthenticated()")
  public Map<String, Object> list(Authentication authentication) {
    return service.list(authentication);
  }

  @PostMapping("/read")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  @PreAuthorize("isAuthenticated()")
  public void markRead(@RequestBody @jakarta.validation.Valid ReadRequest request, Authentication authentication) {
    service.markRead(request.keys(), authentication);
  }
}
