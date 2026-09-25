package com.physiocare.clinic.integration.google.client;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class GoogleApiExceptionTest {
  @Test
  void readsTheReasonFromBothOfGooglesErrorShapes() {
    assertThat(GoogleApiClient.reason("{\"error\":\"invalid_grant\",\"error_description\":\"Token has been expired or revoked.\"}"))
        .isEqualTo("invalid_grant");
    assertThat(GoogleApiClient.reason(
            "{\"error\":{\"code\":403,\"message\":\"Rate Limit Exceeded\",\"errors\":[{\"reason\":\"rateLimitExceeded\"}]}}"))
        .isEqualTo("rateLimitExceeded");
    assertThat(GoogleApiClient.reason("<html>Bad Gateway</html>")).isNull();
    assertThat(GoogleApiClient.reason(null)).isNull();
  }

  @Test
  void showsGooglesOwnMessageInsteadOfTheRawBody() {
    assertThat(GoogleApiClient.googleMessage(
            "{\"error\":{\"errors\":[{\"domain\":\"global\",\"reason\":\"badRequest\",\"message\":\"Bad Request\"}],"
                + "\"code\":400,\"message\":\"Bad Request\"}}"))
        .isEqualTo("Bad Request (badRequest)");
    assertThat(GoogleApiClient.googleMessage("{\"error\":\"invalid_grant\",\"error_description\":\"Token has been expired or revoked.\"}"))
        .isEqualTo("Token has been expired or revoked.");
    assertThat(GoogleApiClient.googleMessage("<html>Bad Gateway</html>")).isNull();
  }

  @Test
  void aRateLimitIsRetriedSoonRatherThanParkedForADay() {
    GoogleApiException slowDown = new GoogleApiException(403, "rateLimitExceeded", "Rate Limit Exceeded");
    assertThat(slowDown.rateLimited()).isTrue();
    assertThat(slowDown.permanent()).isFalse();
    assertThat(slowDown.unauthorised()).isFalse();
    assertThat(new GoogleApiException(429, "Too many requests").permanent()).isFalse();
  }

  @Test
  void aRevokedGrantAndAWrongClientKeyAreToldApart() {
    GoogleApiException revoked = new GoogleApiException(400, "invalid_grant", "revoked");
    assertThat(revoked.grantRevoked()).isTrue();
    assertThat(revoked.unauthorised()).isTrue();
    assertThat(revoked.permanent()).isTrue();

    GoogleApiException wrongClient = new GoogleApiException(401, "invalid_client", "bad client");
    assertThat(wrongClient.clientMisconfigured()).isTrue();
    assertThat(wrongClient.grantRevoked()).isFalse();
  }

  @Test
  void aServerErrorIsRetried() {
    GoogleApiException outage = new GoogleApiException(503, "Google answered 503");
    assertThat(outage.permanent()).isFalse();
    assertThat(outage.unauthorised()).isFalse();
  }
}
