package com.physiocare.clinic.patient;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class PiiCryptoServiceTest {
  @Test
  void encryptedIdentityCanBeDisplayedAgainWithoutStoringPlaintext() {
    PiiCryptoService crypto = new PiiCryptoService("test-pii-key", "test-jwt-key");

    String ciphertext = crypto.encrypt("1101700203456");

    assertThat(ciphertext).isNotEqualTo("1101700203456");
    assertThat(crypto.decrypt(ciphertext)).isEqualTo("1101700203456");
  }
}
