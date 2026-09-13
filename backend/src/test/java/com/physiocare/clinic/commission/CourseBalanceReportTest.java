package com.physiocare.clinic.commission;

import static org.assertj.core.api.Assertions.assertThat;

import com.physiocare.clinic.report.ReportService;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

class CourseBalanceReportTest extends AbstractCommissionIntegrationTest {
  @Autowired private ReportService reports;

  @Test
  void reportsBonusTransfersMembersAndTransferOnlyCourses() {
    long seller = seedStaff("Balance Seller");
    long owner = seedStaff("Balance Owner");
    long patient = seedPatient("Balance Patient");
    long member = seedPatient("Balance Member");
    long sold = seedCourse(seller, owner, patient, new BigDecimal("1000"), 10, LocalDate.of(2026, 9, 1));
    db.update("UPDATE patient_courses SET bonus_visits=2,transfer_in_visits=3,transfer_out_visits=1,visits_used=4 WHERE id=?", sold);
    db.update("UPDATE course_member_balances SET used_visits=4 WHERE patient_course_id=? AND patient_id=?", sold, patient);
    db.update("INSERT INTO shared_course_members(patient_course_id,patient_id,role) VALUES(?,?,'MEMBER')", sold, member);
    db.update("INSERT INTO course_member_balances(patient_course_id,patient_id,allocated_visits,used_visits) VALUES(?,?,?,?)", sold, member, 4, 1);

    long transferOnly = nextId();
    db.update("INSERT INTO patient_courses(id,course_id,patient_id,package_id,package_name_snapshot,sale_date,sale_month,total_visits,bonus_visits,transfer_in_visits,transfer_out_visits,visits_used,branch_id,status,commission_status) VALUES(?,?,?,(SELECT id FROM courses LIMIT 1),'Transferred','2026-09-02','2026-09-01',0,0,5,0,1,1,'ACTIVE','PROVISIONAL')", transferOnly, "PC-TRANSFER-" + transferOnly, member);
    db.update("INSERT INTO course_member_balances(patient_course_id,patient_id,allocated_visits,used_visits) VALUES(?,?,?,?)", transferOnly, member, 5, 1);

    Authentication admin = new UsernamePasswordAuthenticationToken("admin", "n/a", List.of(new SimpleGrantedAuthority("report.view")));
    SecurityContextHolder.getContext().setAuthentication(admin);
    List<Map<String,Object>> rows = (List<Map<String,Object>>) reports.courseBalance(1L, admin);

    Map<String,Object> soldRow = rows.stream().filter(r -> r.get("course_id").equals("PC-TEST-" + sold)).findFirst().orElseThrow();
    assertThat(((Number) soldRow.get("purchased")).intValue()).isEqualTo(10);
    assertThat(((Number) soldRow.get("bonus")).intValue()).isEqualTo(2);
    assertThat(((Number) soldRow.get("used")).intValue()).isEqualTo(5);
    assertThat(((Number) soldRow.get("transfer")).intValue()).isEqualTo(2);
    assertThat(((Number) soldRow.get("remaining")).intValue()).isEqualTo(10);
    assertThat(rows).anyMatch(r -> ("PC-TRANSFER-" + transferOnly).equals(r.get("course_id")));
  }
}
