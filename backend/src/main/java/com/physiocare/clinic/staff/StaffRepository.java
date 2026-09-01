package com.physiocare.clinic.staff;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
public interface StaffRepository extends JpaRepository<Staff,Long> {
    Optional<Staff> findFirstByEmailIgnoreCaseAndDeletedAtIsNull(String email);
    java.util.List<Staff> findAllByDeletedAtIsNullOrderByIdAsc();
}
