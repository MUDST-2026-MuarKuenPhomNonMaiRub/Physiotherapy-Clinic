package com.physiocare.clinic.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.physiocare.clinic.model.AppUser;
import com.physiocare.clinic.repository.AppUserRepository;
import com.physiocare.clinic.repository.PasswordResetRepository;
import java.time.OffsetDateTime;
import java.util.Optional;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.server.ResponseStatusException;

class PasswordResetServiceTest {
  private final AppUserRepository users = mock(AppUserRepository.class);
  private final PasswordResetRepository resets = mock(PasswordResetRepository.class);
  private final PasswordResetMailer mailer = mock(PasswordResetMailer.class);
  private final PasswordEncoder encoder = mock(PasswordEncoder.class);
  private final AuditService audit = mock(AuditService.class);
  private final PasswordResetService service =
      new PasswordResetService(users, resets, mailer, encoder, audit, "http://clinic.test/", 30);

  @BeforeEach
  void startSynchronization() {
    TransactionSynchronizationManager.initSynchronization();
  }

  @AfterEach
  void clearSynchronization() {
    TransactionSynchronizationManager.clearSynchronization();
  }

  @Test
  void unknownAddressGetsNoTokenAndNoEmail() {
    when(users.findByEmailIgnoreCaseAndDeletedAtIsNull("nobody@clinic.test")).thenReturn(Optional.empty());

    service.requestReset("  Nobody@Clinic.test ");
    commit();

    verify(resets, never()).insert(anyLong(), anyString(), any());
    verify(mailer, never()).sendAsync(anyString(), anyString(), anyString(), anyLong());
  }

  @Test
  void inactiveAccountGetsNoEmail() {
    AppUser user = user(7L, false);
    when(users.findByEmailIgnoreCaseAndDeletedAtIsNull("staff@clinic.test")).thenReturn(Optional.of(user));

    service.requestReset("staff@clinic.test");
    commit();

    verify(mailer, never()).sendAsync(anyString(), anyString(), anyString(), anyLong());
  }

  @Test
  void requestStoresOnlyTheHashAndMailsTheRawTokenAfterCommit() {
    AppUser user = user(7L, true);
    when(users.findByEmailIgnoreCaseAndDeletedAtIsNull("staff@clinic.test")).thenReturn(Optional.of(user));

    service.requestReset("staff@clinic.test");
    verify(mailer, never()).sendAsync(anyString(), anyString(), anyString(), anyLong());
    commit();

    ArgumentCaptor<String> storedHash = ArgumentCaptor.forClass(String.class);
    ArgumentCaptor<String> link = ArgumentCaptor.forClass(String.class);
    verify(resets).retireOpenTokens(7L);
    verify(resets).insert(eq(7L), storedHash.capture(), any(OffsetDateTime.class));
    verify(mailer).sendAsync(eq("staff@clinic.test"), eq("Somchai"), link.capture(), eq(30L));

    assertThat(link.getValue()).startsWith("http://clinic.test/reset-password?token=");
    String token = link.getValue().substring(link.getValue().indexOf('=') + 1);
    assertThat(token).hasSizeGreaterThanOrEqualTo(43);
    assertThat(storedHash.getValue()).isEqualTo(PasswordResetService.hash(token)).isNotEqualTo(token);
  }

  @Test
  void tooManyRecentRequestsAreSilentlyIgnored() {
    AppUser user = user(7L, true);
    when(users.findByEmailIgnoreCaseAndDeletedAtIsNull("staff@clinic.test")).thenReturn(Optional.of(user));
    when(resets.countRequestedSince(eq(7L), any())).thenReturn(PasswordResetService.MAX_REQUESTS_PER_WINDOW);

    service.requestReset("staff@clinic.test");
    commit();

    verify(resets, never()).insert(anyLong(), anyString(), any());
    verify(mailer, never()).sendAsync(anyString(), anyString(), anyString(), anyLong());
  }

  @Test
  void unusableTokenIsRejectedWithoutTouchingThePassword() {
    when(resets.lockUsableTokenOwner(anyString())).thenReturn(Optional.empty());

    assertThatThrownBy(() -> service.resetPassword("expired-token", "N3w!Password12"))
        .isInstanceOf(ResponseStatusException.class)
        .hasMessageContaining("invalid or has expired");
    verify(resets, never()).updatePassword(anyLong(), anyString());
  }

  @Test
  void validTokenSetsTheNewPasswordAndRetiresEveryLink() {
    AppUser user = user(7L, true);
    when(resets.lockUsableTokenOwner(PasswordResetService.hash("good-token"))).thenReturn(Optional.of(7L));
    when(users.findById(7L)).thenReturn(Optional.of(user));
    when(encoder.encode("N3w!Password12")).thenReturn("bcrypt-hash");

    service.resetPassword("good-token", "N3w!Password12");

    verify(resets).updatePassword(7L, "bcrypt-hash");
    verify(resets).retireOpenTokens(7L);
    verify(resets).clearLoginLockout("staff@clinic.test");
    verify(audit).record(eq(7L), eq(null), eq("PASSWORD_RESET"), eq("USER"), eq("7"), eq(null), eq(null), anyString());
  }

  private static AppUser user(long id, boolean active) {
    AppUser user = mock(AppUser.class);
    when(user.getId()).thenReturn(id);
    when(user.getEmail()).thenReturn("staff@clinic.test");
    when(user.getFirstName()).thenReturn("Somchai");
    when(user.isActive()).thenReturn(active);
    return user;
  }

  private static void commit() {
    TransactionSynchronizationManager.getSynchronizations().forEach(TransactionSynchronization::afterCommit);
  }
}
