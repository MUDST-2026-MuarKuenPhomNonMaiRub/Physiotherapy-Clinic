package com.physiocare.clinic.checkout;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.physiocare.clinic.commission.AbstractCommissionIntegrationTest;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class LegacyTransferReconciliationServiceTest extends AbstractCommissionIntegrationTest {
  @Autowired private LegacyTransferReconciliationService reconciliation;

  @Test
  void dryRunReportsConfidentDuplicateWithoutChangingFixtures() {
    long owner = seedStaff("Legacy owner");
    long sourcePatient = seedPatient("Legacy source");
    long recipient = seedPatient("Legacy recipient");
    long source = seedCourse(owner, owner, sourcePatient, java.math.BigDecimal.valueOf(1000), 10, LocalDate.now());
    long duplicate = seedCourse(owner, owner, recipient, java.math.BigDecimal.ZERO, 0, LocalDate.now());
    db.update("UPDATE patient_courses SET package_id=(SELECT package_id FROM patient_courses WHERE id=?), transfer_in_visits=4 WHERE id=?", source, duplicate);
    db.update("INSERT INTO course_transfers(transfer_no,patient_course_id,to_patient_course_id,from_patient_id,to_patient_id,quantity) SELECT ?,?,?,patient_id,?,4 FROM patient_courses WHERE id=?", "LEGACY-" + duplicate, source, duplicate, recipient, source);
    db.update("UPDATE course_member_balances SET allocated_visits=4,used_visits=1 WHERE patient_course_id=? AND patient_id=?", duplicate, recipient);

    var report = reconciliation.reconcile(true);

    assertThat(report.confident()).isEqualTo(1);
    assertThat(report.mutated()).isZero();
    assertThat(db.queryForObject("SELECT allocated_visits FROM course_member_balances WHERE patient_course_id=? AND patient_id=?", Integer.class, duplicate, recipient)).isEqualTo(4);
  }

  @Test
  void reconcileMovesHolderBalanceAndIsIdempotent() {
    long owner = seedStaff("Legacy owner 2");
    long sourcePatient = seedPatient("Legacy source 2");
    long recipient = seedPatient("Legacy recipient 2");
    long source = seedCourse(owner, owner, sourcePatient, java.math.BigDecimal.valueOf(1000), 10, LocalDate.now());
    long duplicate = seedCourse(owner, owner, recipient, java.math.BigDecimal.ZERO, 0, LocalDate.now());
    db.update("UPDATE patient_courses SET package_id=(SELECT package_id FROM patient_courses WHERE id=?), transfer_in_visits=4 WHERE id=?", source, duplicate);
    db.update("INSERT INTO course_transfers(transfer_no,patient_course_id,to_patient_course_id,from_patient_id,to_patient_id,quantity) SELECT ?,?,?,patient_id,?,4 FROM patient_courses WHERE id=?", "LEGACY-" + duplicate, source, duplicate, recipient, source);
    db.update("UPDATE course_member_balances SET allocated_visits=4,used_visits=1 WHERE patient_course_id=? AND patient_id=?", duplicate, recipient);

    assertThat(reconciliation.reconcile(false).mutated()).isEqualTo(1);
    assertThat(reconciliation.reconcile(false).mutated()).isZero();
    assertThat(db.queryForObject("SELECT allocated_visits FROM course_member_balances WHERE patient_course_id=? AND patient_id=?", Integer.class, source, recipient)).isEqualTo(4);
    assertThat(db.queryForObject("SELECT used_visits FROM course_member_balances WHERE patient_course_id=? AND patient_id=?", Integer.class, source, recipient)).isEqualTo(1);
    assertThat(db.queryForObject("SELECT status FROM patient_courses WHERE id=?", String.class, duplicate)).isEqualTo("RECONCILED");
  }

  @Test
  void ambiguousTransferIsReportedAndNotMutated() {
    long owner = seedStaff("Legacy owner 3");
    long sourcePatient = seedPatient("Legacy source 3");
    long recipient = seedPatient("Legacy recipient 3");
    long source = seedCourse(owner, owner, sourcePatient, java.math.BigDecimal.valueOf(1000), 10, LocalDate.now());
    long duplicate = seedCourse(owner, owner, recipient, java.math.BigDecimal.ZERO, 0, LocalDate.now());
    db.update("UPDATE patient_courses SET package_id=(SELECT package_id FROM patient_courses WHERE id=?), transfer_in_visits=4 WHERE id=?", source, duplicate);
    db.update("INSERT INTO course_transfers(transfer_no,patient_course_id,to_patient_course_id,from_patient_id,to_patient_id,quantity) SELECT ?,?,?,patient_id,?,4 FROM patient_courses WHERE id=?", "LEGACY-" + duplicate, source, duplicate, recipient, source);
    db.update("UPDATE course_member_balances SET allocated_visits=4 WHERE patient_course_id=? AND patient_id=?", duplicate, recipient);
    long otherDuplicate = seedCourse(owner, owner, recipient, java.math.BigDecimal.ZERO, 0, LocalDate.now());
    db.update("UPDATE patient_courses SET package_id=(SELECT package_id FROM patient_courses WHERE id=?), transfer_in_visits=1 WHERE id=?", source, otherDuplicate);
    assertThat(reconciliation.reconcile(false).ambiguous()).isEqualTo(1);
    assertThat(db.queryForObject("SELECT status FROM patient_courses WHERE id=?", String.class, duplicate)).isEqualTo("ACTIVE");
  }
}
