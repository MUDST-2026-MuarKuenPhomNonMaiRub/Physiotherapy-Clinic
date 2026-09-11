package com.physiocare.clinic.commission;

import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.annotation.Transactional;

/**
 * Every commission integration test runs against a real, throwaway
 * PostgreSQL instance with the actual Flyway migrations (V1-V12) applied —
 * never H2, never a mock.
 *
 * <p>This intentionally does not use the Testcontainers Java library:
 * on this host, its bundled docker-java client cannot talk to a very recent
 * Docker Desktop (API 1.53) — every provider strategy gets back a
 * malformed/empty {@code /info} response. Rather than fight that
 * incompatibility, the throwaway Postgres is started the same way Phase 1's
 * migration verification was — a plain {@code docker run} — by
 * {@code run-commission-tests.sh}, and these tests just point at it via
 * system properties. Run through that script, or export the same
 * {@code it.db.*} properties against any disposable PostgreSQL 16 instance
 * (never the application's real database).
 *
 * <p>{@code @Transactional} wraps each test method in a transaction that
 * rolls back at the end — every {@code @Transactional} service call under
 * test joins that same transaction (Spring's default REQUIRED propagation),
 * so tests never leak fixtures into one another despite sharing one database
 * for the whole run.
 */
@SpringBootTest
@Transactional
public abstract class AbstractCommissionIntegrationTest {

  @DynamicPropertySource
  static void datasourceProperties(DynamicPropertyRegistry registry) {
    registry.add(
        "spring.datasource.url",
        () -> System.getProperty("it.db.url", "jdbc:postgresql://localhost:15433/physiocare_it"));
    registry.add("spring.datasource.username", () -> System.getProperty("it.db.username", "physiocare"));
    registry.add("spring.datasource.password", () -> System.getProperty("it.db.password", "physiocare"));
    registry.add(
        "app.security.jwt.secret",
        () -> "dGVzdC1zZWNyZXQtZm9yLWludGVncmF0aW9uLXRlc3RzLTAwMDAwMDAwMDA=");
  }

  @Autowired protected JdbcTemplate db;

  private long nextTestId = 800001;

  @BeforeEach
  void resetSequenceRoom() {
    // Test fixture ids stay in a private range above anything Flyway seeds.
    nextTestId = 800001 + (System.nanoTime() % 100000);
  }

  protected long nextId() {
    return nextTestId++;
  }

  protected long seedStaff(String name) {
    long userId = nextId();
    long staffId = nextId();
    db.update(
        "INSERT INTO users(id,email,password_hash,first_name,last_name,active) VALUES(?,?,'x',?,?,true)",
        userId, "staff" + staffId + "@test.local", name, "T");
    db.update(
        "INSERT INTO staff(id,name,position,email,user_id,branch_ids) VALUES(?,?,?,?,?, '[1]')",
        staffId, name, "Physiotherapist", "staff" + staffId + "@test.local", userId);
    return staffId;
  }

  /** A bare users row to use as the actor on an adjustment/override — every real caller has one. */
  protected long seedActorUserId() {
    long userId = nextId();
    db.update(
        "INSERT INTO users(id,email,password_hash,first_name,last_name,active) VALUES(?,?,'x','Actor','Test',true)",
        userId, "actor" + userId + "@test.local");
    return userId;
  }

  protected long seedPatient(String name) {
    long id = nextId();
    db.update(
        "INSERT INTO patients(id,hn,registered_branch_id,customer_type,prefix,first_name_th,"
            + "last_name_th,gender_code,phone) VALUES(?,?,1,'WALKIN','Mr',?,?,'MALE',?)",
        id, "HN" + id, name, "Test", "080" + id);
    return id;
  }

  /**
   * A commission scheme with one flat-rate tier covering every sales amount,
   * versioned above the seeded DEFAULT scheme so it always wins regardless of
   * which "code" Postgres happens to order first.
   */
  protected long seedFlatScheme(String code, java.math.BigDecimal rate, String overflowPolicy) {
    long schemeId =
        db.queryForObject(
            "INSERT INTO commission_schemes(code,version,effective_from,overflow_policy) VALUES"
                + "(?,2,'2020-01-01',?) RETURNING id",
            Long.class,
            code,
            overflowPolicy == null ? "CAP_AT_COMMISSION" : overflowPolicy);
    db.update(
        "INSERT INTO commission_tiers(scheme_id,tier_order,minimum_monthly_sales,"
            + "maximum_monthly_sales,commission_rate) VALUES(?,1,0,NULL,?)",
        schemeId,
        rate);
    return schemeId;
  }

  /** Directly inserts a PROVISIONAL course the way CheckoutService/CommissionService would. */
  protected long seedCourse(
      long sellerId,
      long caseOwnerId,
      long patientId,
      java.math.BigDecimal price,
      int totalVisits,
      java.time.LocalDate saleDate) {
    long id = nextId();
    db.update(
        "INSERT INTO patient_courses(id,course_id,patient_id,package_id,package_name_snapshot,"
            + "sale_date,sale_month,seller_employee_id,case_owner_employee_id,"
            + "seller_name_snapshot,case_owner_name_snapshot,course_price,net_course_sale_amount,"
            + "total_visits,commissionable_visit_count,branch_id,status,commission_status)"
            + " VALUES(?,?,?,(SELECT id FROM courses LIMIT 1),'Test Package',?,date_trunc('month',"
            + "?::date),?,?,'Seller','Owner',?,?,?,?,1,'ACTIVE','PROVISIONAL')",
        id, "PC-TEST-" + id, patientId, saleDate, saleDate, sellerId, caseOwnerId, price, price,
        totalVisits, totalVisits);
    db.update(
        "INSERT INTO shared_course_members(patient_course_id,patient_id,role) VALUES(?,?,'OWNER')",
        id, patientId);
    db.update(
        "INSERT INTO course_member_balances(patient_course_id,patient_id,allocated_visits)"
            + " VALUES(?,?,?)",
        id, patientId, totalVisits);
    return id;
  }
}
