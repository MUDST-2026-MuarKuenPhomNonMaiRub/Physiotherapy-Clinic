package com.physiocare.clinic.googlecalendar.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

class OAuthStateServiceTest {
  private static final String SECRET = "c2VjcmV0LXNlY3JldC1zZWNyZXQtc2VjcmV0LXNlY3JldA==";

  @Test
  void stateRoundTripsTheStaffAndUser() {
    OAuthStateService states = new OAuthStateService(SECRET);

    OAuthStateService.State state = states.verify(states.issue(7, 3));

    assertThat(state.staffId()).isEqualTo(7);
    assertThat(state.userId()).isEqualTo(3);
  }

  @Test
  void alteredStateIsRejected() {
    OAuthStateService states = new OAuthStateService(SECRET);
    String issued = states.issue(7, 3);
    String tampered = issued.substring(0, issued.length() - 2) + (issued.endsWith("A") ? "BB" : "AA");

    assertThatThrownBy(() -> states.verify(tampered)).isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  void stateSignedUnderAnotherSecretIsRejected() {
    String issued = new OAuthStateService("b3RoZXItb3RoZXItb3RoZXItb3RoZXItb3RoZXI=").issue(7, 3);

    assertThatThrownBy(() -> new OAuthStateService(SECRET).verify(issued))
        .isInstanceOf(IllegalArgumentException.class);
  }
}
