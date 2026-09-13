package com.physiocare.clinic.checkout;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Database operations used by the checkout use-case. */
@Repository
public class CheckoutRepository {
  private final JdbcTemplate db;

  public CheckoutRepository(JdbcTemplate db) {
    this.db = db;
  }

  public Map<String, Object> row(String sql, Object argument, String label) {
    List<Map<String, Object>> rows = db.queryForList(sql, argument);
    if (rows.isEmpty()) throw new IllegalArgumentException(label + " not found");
    return rows.get(0);
  }

  public boolean isCash(long paymentMethodId) {
    return Boolean.TRUE.equals(
        db.queryForObject(
            "SELECT EXISTS(SELECT 1 FROM payment_methods WHERE id=? AND code='CASH')",
            Boolean.class,
            paymentMethodId));
  }

  public long createPatientCourse(
      long patientId, long branchId, long packageId, String packageName, int sessions, int bonus,
      BigDecimal price, BigDecimal discountRatio, Integer validityDays, Long salesTransactionId,
      Long sellerId, Long caseOwnerId, LocalDate today) {
    Long seller = sellerId != null ? sellerId : caseOwnerId;
    Long owner = caseOwnerId != null ? caseOwnerId : seller;
    String sellerName = seller == null ? "" : staffName(seller);
    String ownerName = owner == null ? sellerName : staffName(owner);
    BigDecimal netSaleAmount = price.multiply(discountRatio).setScale(2, java.math.RoundingMode.HALF_UP);
    long id =
        db.queryForObject(
            "INSERT INTO patient_courses(course_id,receipt_no,sales_transaction_id,patient_id,"
                + "package_id,package_name_snapshot,sale_date,sale_month,seller_employee_id,"
                + "case_owner_employee_id,seller_name_snapshot,case_owner_name_snapshot,"
                + "course_price,net_course_sale_amount,total_visits,commissionable_visit_count,"
                + "bonus_visits,branch_id,valid_until,status)"
                + " VALUES(?,?,?,?,?,?,?,date_trunc('month',?::date),?,?,?,?,?,?,?,?,?,?,?,'ACTIVE')"
                + " RETURNING id",
            Long.class,
            nextNumber("PC", "patient_courses", "course_id"),
            salesTransactionId == null
                ? null
                : db.queryForObject(
                    "SELECT transaction_no FROM sales_transactions WHERE id=?", String.class,
                    salesTransactionId),
            salesTransactionId,
            patientId,
            packageId,
            packageName,
            today,
            today,
            seller,
            owner,
            sellerName,
            ownerName,
            price,
            netSaleAmount,
            sessions,
            sessions,
            bonus,
            branchId,
            validityDays == null ? null : today.plusDays(validityDays));
    db.update(
        "INSERT INTO shared_course_members(patient_course_id,patient_id,role) VALUES(?,?,'OWNER')"
            + " ON CONFLICT (patient_course_id,patient_id) DO NOTHING",
        id, patientId);
    db.update(
        "INSERT INTO course_member_balances(patient_course_id,patient_id,allocated_visits,used_visits)"
            + " VALUES(?,?,?,0) ON CONFLICT (patient_course_id,patient_id) DO NOTHING",
        id, patientId, sessions + bonus);
    return id;
  }

  public long addLedgerEntry(
      long patientCourseId, String entryType, int quantity, int balanceAfter, long branchId,
      Long transactionId, String performedBy, Long performedByUserId, String transferGroupId,
      Long reversalOfId) {
    return db.queryForObject(
        "INSERT INTO course_ledger_entries(patient_course_id,entry_type,quantity,balance_after,"
            + "branch_id,related_transaction_id,performed_by_name,created_by,transfer_group_id,"
            + "reversal_of_id) VALUES(?,?,?,?,?,?,?,?,?,?) RETURNING id",
        Long.class,
        patientCourseId, entryType, quantity, balanceAfter, branchId, transactionId, performedBy,
        performedByUserId, transferGroupId, reversalOfId);
  }

  public void addItem(
      long transactionId, String itemType, Long serviceId, Long courseId, String description,
      BigDecimal amount, String kind) {
    db.update(
        "INSERT INTO sales_items(sales_transaction_id,item_type,service_id,course_id,"
            + "description_snapshot,quantity,unit_price,total_amount,item_kind)"
            + " VALUES(?,?,?,?,?,1,?,?,?)",
        transactionId, itemType, serviceId, courseId, description, amount, amount, kind);
  }

  public Map<String, Object> lockPatientCourse(long id) {
    return row("SELECT * FROM patient_courses WHERE id=? FOR UPDATE", id, "Course");
  }

  public Map<String, Object> patientCourse(long id) {
    return row("SELECT * FROM patient_courses WHERE id=?", id, "Course");
  }

  public void refreshCourseStatus(long patientCourseId) {
    db.update(
        "UPDATE patient_courses SET status = CASE"
            + " WHEN status='REFUNDED' THEN 'REFUNDED'"
            + " WHEN valid_until IS NOT NULL AND valid_until < CURRENT_DATE THEN 'EXPIRED'"
            + " WHEN (total_visits+bonus_visits+transfer_in_visits-visits_used-transfer_out_visits) <= 0"
            + " THEN 'USED_UP' ELSE 'ACTIVE' END WHERE id=?",
        patientCourseId);
  }

  public String staffName(long staffId) {
    List<String> names = db.queryForList("SELECT name FROM staff WHERE id=?", String.class, staffId);
    return names.isEmpty() ? "" : names.get(0);
  }

  public String nextNumber(String prefix, String table, String column) {
    Long next = db.queryForObject("SELECT count(*)+1 FROM " + table, Long.class);
    String candidate = String.format("%s-%d-%06d", prefix, LocalDate.now().getYear(), next);
    while (Boolean.TRUE.equals(
        db.queryForObject(
            "SELECT EXISTS(SELECT 1 FROM " + table + " WHERE " + column + "=?)",
            Boolean.class, candidate))) {
      next++;
      candidate = String.format("%s-%d-%06d", prefix, LocalDate.now().getYear(), next);
    }
    return candidate;
  }
}
