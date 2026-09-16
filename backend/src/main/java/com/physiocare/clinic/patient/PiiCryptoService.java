package com.physiocare.clinic.patient;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/** Encrypts identity values for authorised display while hashes remain for uniqueness checks. */
@Service
public class PiiCryptoService {
  private static final int IV_BYTES = 12;
  private static final int TAG_BITS = 128;
  private final SecretKeySpec key;
  private final SecureRandom random = new SecureRandom();

  public PiiCryptoService(
      @Value("${app.security.pii-key:}") String piiSecret,
      @Value("${app.security.jwt.secret}") String jwtSecret) {
    try {
      String secret = piiSecret.isBlank() ? jwtSecret : piiSecret;
      byte[] digest = MessageDigest.getInstance("SHA-256").digest(secret.getBytes(StandardCharsets.UTF_8));
      this.key = new SecretKeySpec(digest, "AES");
    } catch (Exception e) {
      throw new IllegalStateException("Unable to initialise PII encryption", e);
    }
  }

  public String encrypt(String value) {
    if (value == null || value.isBlank()) return null;
    try {
      byte[] iv = new byte[IV_BYTES];
      random.nextBytes(iv);
      Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
      cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(TAG_BITS, iv));
      return Base64.getEncoder().encodeToString(iv) + ":"
          + Base64.getEncoder().encodeToString(cipher.doFinal(value.trim().getBytes(StandardCharsets.UTF_8)));
    } catch (Exception e) {
      throw new IllegalStateException("Unable to encrypt identity value", e);
    }
  }

  public String decrypt(String ciphertext) {
    if (ciphertext == null || ciphertext.isBlank()) return null;
    try {
      String[] parts = ciphertext.split(":", 2);
      Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
      cipher.init(Cipher.DECRYPT_MODE, key,
          new GCMParameterSpec(TAG_BITS, Base64.getDecoder().decode(parts[0])));
      return new String(cipher.doFinal(Base64.getDecoder().decode(parts[1])), StandardCharsets.UTF_8);
    } catch (Exception e) {
      throw new IllegalStateException("Unable to decrypt identity value", e);
    }
  }
}
