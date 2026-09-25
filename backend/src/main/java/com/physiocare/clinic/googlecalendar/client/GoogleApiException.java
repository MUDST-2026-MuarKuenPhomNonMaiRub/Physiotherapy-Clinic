package com.physiocare.clinic.googlecalendar.client;

/** A refusal or failure reported by a Google endpoint. */
public class GoogleApiException extends RuntimeException {
  private final int status;
  private final String errorCode;

  public GoogleApiException(int status, String errorCode, String message) {
    super(message);
    this.status = status;
    this.errorCode = errorCode;
  }

  public int status() {
    return status;
  }

  public String errorCode() {
    return errorCode;
  }

  /** The event is gone — 410 is what Google answers for one deleted earlier. */
  public boolean isNotFound() {
    return status == 404 || status == 410;
  }

  /** An event with that id already exists. */
  public boolean isConflict() {
    return status == 409;
  }

  /**
   * The stored grant no longer works; only reconnecting fixes it. A rejected
   * client id or secret ({@code invalid_client}) is a server setting instead,
   * and reconnecting would not help.
   */
  public boolean isAuthFailure() {
    return "invalid_grant".equals(errorCode) || (status == 401 && !isClientMisconfigured());
  }

  public boolean isClientMisconfigured() {
    return "invalid_client".equals(errorCode) || "unauthorized_client".equals(errorCode);
  }
}
