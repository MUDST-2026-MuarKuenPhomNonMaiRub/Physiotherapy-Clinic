package com.physiocare.clinic.patient;

import static org.junit.jupiter.api.Assertions.*;

import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

class PatientSearchIntegrationTest extends com.physiocare.clinic.commission.AbstractCommissionIntegrationTest {
  @Autowired private PatientService service;
  private Authentication admin;
  private Authentication branchOneUser;
  private long branchOnePatientId;
  private long branchTwoPatientId;

  @BeforeEach
  void setUpSearchFixtures() {
    long userId = nextId();
    String email = "patient-search-" + userId + "@test.local";
    db.update(
        "INSERT INTO users(id,email,password_hash,first_name,last_name,active) VALUES(?,?,?, ?,?,true)",
        userId, email, "x", "Search", "Tester");
    db.update(
        "INSERT INTO user_branches(user_id,branch_id,is_default) VALUES(?,1,true)",
        userId);

    admin = new UsernamePasswordAuthenticationToken(
        "admin-search-" + userId + "@test.local", "n/a",
        List.of(new SimpleGrantedAuthority("ROLE_ADMIN")));
    branchOneUser = new UsernamePasswordAuthenticationToken(
        email, "n/a", List.of(new SimpleGrantedAuthority("PERM_PATIENT_VIEW")));

    branchOnePatientId = seedPatient(
        "สมชายค้นหา", "ทดสอบ", "SomchaiSearch", "Tester", "น้องค้นหา", "0899999999",
        "SEARCH-HN-001", 1);
    branchTwoPatientId = seedPatient(
        "สาขาสอง", "ทดสอบ", "BranchTwo", "Patient", "สาขาสอง", "0888888888",
        "SEARCH-HN-002", 2);

    for (int i = 0; i < 100; i++) {
      seedPatient("ผู้ป่วย" + i, "ทดสอบ", "Patient" + i, "Test", "P" + i,
          "080" + String.format("%07d", i), "SEARCH-" + String.format("%03d", i), 1);
    }
  }

  private long seedPatient(
      String firstTh, String lastTh, String firstEn, String lastEn,
      String nickname, String phone, String hn, long branchId) {
    long id = nextId();
    db.update(
        "INSERT INTO patients(id,hn,registered_branch_id,customer_type,prefix,first_name_th,"
            + "last_name_th,first_name_en,last_name_en,nickname,gender_code,phone) "
            + "VALUES(?,?,?,'THAI','Mr',?,?,?,?,?,'MALE',?)",
        id, hn, branchId, firstTh, lastTh, firstEn, lastEn, nickname, phone);
    return id;
  }

  private record PageResult(List<java.util.Map<String, Object>> items, long totalItems,
      int totalPages, boolean hasNext, boolean hasPrevious) {}

  private PageResult page(String search, Long branchId, int page, int size) {
    var response = service.page(search, branchId, page, size, admin);
    return new PageResult(response.items(), response.totalItems(), response.totalPages(),
        response.hasNext(), response.hasPrevious());
  }

  @Test
  void searchesByHn() {
    var result = page("SEARCH-HN-001", null, 0, 25);
    assertEquals(1, result.totalItems());
    assertEquals(branchOnePatientId, ((Number) result.items().get(0).get("id")).longValue());
  }

  @Test
  void searchesByThaiName() {
    var result = page("สมชายค้นหา", null, 0, 25);
    assertEquals(1, result.totalItems());
  }

  @Test
  void searchesByEnglishName() {
    var result = page("SomchaiSearch", null, 0, 25);
    assertEquals(1, result.totalItems());
  }

  @Test
  void searchesByNickname() {
    var result = page("น้องค้นหา", null, 0, 25);
    assertEquals(1, result.totalItems());
  }

  @Test
  void searchesByPhone() {
    var result = page("0899999999", null, 0, 25);
    assertEquals(1, result.totalItems());
  }

  @Test
  void emptySearchReturnsAllAccessiblePatients() {
    var result = page("", null, 0, 25);
    assertEquals(102, result.totalItems());
    assertEquals(5, result.totalPages());
    assertEquals(25, result.items().size());
  }

  @Test
  void noMatchReturnsEmptyPage() {
    var result = page("definitely-not-a-real-patient", null, 0, 25);
    assertEquals(0, result.totalItems());
    assertEquals(0, result.totalPages());
    assertTrue(result.items().isEmpty());
  }
  @Test
  void paginationHasStableTotalsAndNoOverlap() {
    var first = page("", null, 0, 25);
    var second = page("", null, 1, 25);

    assertEquals(102, first.totalItems());
    assertEquals(5, first.totalPages());
    assertTrue(first.hasNext());
    assertFalse(first.hasPrevious());
    assertTrue(second.hasNext());
    assertTrue(second.hasPrevious());

    Set<Long> firstIds = first.items().stream()
        .map(row -> ((Number) row.get("id")).longValue())
        .collect(java.util.stream.Collectors.toSet());
    Set<Long> secondIds = second.items().stream()
        .map(row -> ((Number) row.get("id")).longValue())
        .collect(java.util.stream.Collectors.toSet());
    assertEquals(25, firstIds.size());
    assertEquals(25, secondIds.size());
    assertTrue(java.util.Collections.disjoint(firstIds, secondIds));
  }

  @Test
  void branchFilterDoesNotExposeAnotherBranch() {
    var result = service.page("SEARCH-HN-002", 1L, 0, 25, branchOneUser);
    assertEquals(0, result.totalItems());

    var ownBranch = service.page("SEARCH-HN-001", 1L, 0, 25, branchOneUser);
    assertEquals(1, ownBranch.totalItems());

    assertNotEquals(branchTwoPatientId,
        ownBranch.items().stream()
            .map(row -> ((Number) row.get("id")).longValue())
            .findFirst()
            .orElse(-1L));
  }

  @Test
  void sqlInjectionInputRemainsAPlainSearchValue() {
    var result = page("' OR 1=1 --", null, 0, 25);
    assertEquals(0, result.totalItems());
  }

  @Test
  void pageSizeIsBoundedByRequestedSizeAndDoesNotLoadWholeTable() {
    var result = page("", null, 2, 25);
    assertEquals(25, result.items().size());
    assertEquals(102, result.totalItems());
  }
}
