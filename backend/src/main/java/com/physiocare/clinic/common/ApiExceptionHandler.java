package com.physiocare.clinic.common;

import java.time.Instant;
import java.util.Map;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.http.*;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

@RestControllerAdvice
public class ApiExceptionHandler {
  private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);

  @ExceptionHandler(MethodArgumentNotValidException.class)
  ResponseEntity<?> validation(MethodArgumentNotValidException e) {
    return ResponseEntity.badRequest()
        .body(
            Map.of(
                "timestamp",
                Instant.now(),
                "error",
                "VALIDATION_ERROR",
                "details",
                e.getBindingResult().getFieldErrors().stream()
                    .collect(
                        Collectors.toMap(
                            x -> x.getField(), x -> x.getDefaultMessage(), (a, b) -> a))));
  }

  @ExceptionHandler(EmptyResultDataAccessException.class)
  ResponseEntity<?> notFound(EmptyResultDataAccessException e) {
    return ResponseEntity.status(HttpStatus.NOT_FOUND)
        .body(Map.of("timestamp", Instant.now(), "error", "NOT_FOUND"));
  }

  @ExceptionHandler(IllegalArgumentException.class)
  ResponseEntity<?> invalid(IllegalArgumentException e) {
    return ResponseEntity.badRequest()
        .body(
            Map.of(
                "timestamp", Instant.now(), "error", "INVALID_REQUEST", "message", e.getMessage()));
  }

  /** A denied write is the caller's answer, not a server fault. */
  @ExceptionHandler(AccessDeniedException.class)
  ResponseEntity<?> forbidden(AccessDeniedException e) {
    return ResponseEntity.status(HttpStatus.FORBIDDEN)
        .body(
            Map.of(
                "timestamp",
                Instant.now(),
                "error",
                "FORBIDDEN",
                "message",
                "You do not have permission to do that."));
  }

  /** Carries through the status a service chose deliberately, such as 409 on a duplicate. */
  @ExceptionHandler(ResponseStatusException.class)
  ResponseEntity<?> statusException(ResponseStatusException e) {
    return ResponseEntity.status(e.getStatusCode())
        .body(
            Map.of(
                "timestamp",
                Instant.now(),
                "error",
                e.getStatusCode().value() == 409 ? "CONFLICT" : "REQUEST_FAILED",
                "message",
                e.getReason() == null ? "The request could not be completed." : e.getReason()));
  }

  @ExceptionHandler(Exception.class)
  ResponseEntity<?> unexpected(Exception e) {
    log.error("Unhandled error while serving a request", e);
    return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
        .body(Map.of("timestamp", Instant.now(), "error", "INTERNAL_ERROR"));
  }

  @ExceptionHandler(NoResourceFoundException.class)
  ResponseEntity<?> notFound(NoResourceFoundException e) {
    return ResponseEntity.status(HttpStatus.NOT_FOUND)
        .body(Map.of("timestamp", Instant.now(), "error", "NOT_FOUND"));
  }
}
