package com.physiocare.clinic.staff;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface StaffRepository extends JpaRepository<Staff, Long> {
  Optional<Staff> findFirstByEmailIgnoreCaseAndDeletedAtIsNull(String email);

  java.util.List<Staff> findAllByDeletedAtIsNullOrderByIdAsc();
}
