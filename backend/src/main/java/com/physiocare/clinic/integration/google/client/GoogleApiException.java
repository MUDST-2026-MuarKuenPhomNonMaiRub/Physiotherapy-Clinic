package com.physiocare.clinic.integration.google.client;

import java.util.Set;

/**
 * Any answer from Google other than success. The HTTP status and Google's own
 * reason code decide whether a retry can help and what the person should do.
 */
public class GoogleApiException extends RuntimeException {
  /** Google's quota reasons: a 403 with one of these is "slow down", not "forbidden". */
  private static final Set<String> RATE_LIMIT_REASONS =
      Set.of("rateLimitExceeded", "userRateLimitExceeded", "quotaExceeded", "dailyLimitExceeded");

  private final int status;
  private final String reason;

  public GoogleApiException(int status, String message) {
    this(status, null, message);
  }

  /**
   * @param reason Google's code: {@code error} from the OAuth endpoints (such as
   *     {@code invalid_grant}), or {@code errors[0].reason} from the Calendar API
   */
  public GoogleApiException(int status, String reason, String message) {
    super(message);
    this.status = status;
    this.reason = reason;
  }

  public int status() {
    return status;
  }

  public String reason() {
    return reason;
  }

  public boolean rateLimited() {
    return status == 429 || (status == 403 && reason != null && RATE_LIMIT_REASONS.contains(reason));
  }

  /** A 4xx that Google will never accept as sent — retrying soon is pointless. */
  public boolean permanent() {
    return status >= 400 && status < 500 && !rateLimited();
  }

  /** The cached access token is no good; drop it and mint a new one next time. */
  public boolean unauthorised() {
    return status == 401 || (status == 403 && !rateLimited()) || grantRevoked();
  }

  /** The person withdrew access or the grant expired; only connecting again fixes it. */
  public boolean grantRevoked() {
    return "invalid_grant".equals(reason);
  }

  /** The server's client id or secret is wrong — a setting to fix, not the person's grant. */
  public boolean clientMisconfigured() {
    return "invalid_client".equals(reason) || "unauthorized_client".equals(reason);
  }
}
