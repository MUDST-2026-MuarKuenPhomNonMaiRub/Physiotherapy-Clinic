package com.physiocare.clinic.auth;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AppUserRepository extends JpaRepository<AppUser, Long> {

  Optional<AppUser> findByEmailIgnoreCase(String email);

  Optional<AppUser> findByEmailIgnoreCaseAndDeletedAtIsNull(String email);

  boolean existsByEmailIgnoreCase(String email);
}
