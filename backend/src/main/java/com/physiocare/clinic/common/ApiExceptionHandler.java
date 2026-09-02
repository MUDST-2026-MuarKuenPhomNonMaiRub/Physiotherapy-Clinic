package com.physiocare.clinic.common;

import java.time.Instant;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.http.*;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.resource.NoResourceFoundException;

@RestControllerAdvice
public class ApiExceptionHandler {
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

  @ExceptionHandler(Exception.class)
  ResponseEntity<?> unexpected(Exception e) {
    return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
        .body(Map.of("timestamp", Instant.now(), "error", "INTERNAL_ERROR"));
  }

  @ExceptionHandler(NoResourceFoundException.class)
  ResponseEntity<?> notFound(NoResourceFoundException e) {
    return ResponseEntity.status(HttpStatus.NOT_FOUND)
        .body(Map.of("timestamp", Instant.now(), "error", "NOT_FOUND"));
  }
}
