package com.physiocare.clinic.checkout;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/** Assembles a receipt from the sale, its lines, its course movements and its commission. */
@Service
public class TransactionReader {
  private final JdbcTemplate db;

  public TransactionReader(JdbcTemplate db) {
    this.db = db;
  }

  public CheckoutDtos.TransactionView get(long id) {
    List<Map<String, Object>> rows =
        db.queryForList("SELECT * FROM sales_transactions WHERE id=?", id);
    if (rows.isEmpty()) throw new IllegalArgumentException("Transaction not found");
    return toView(rows.get(0));
  }

  public List<CheckoutDtos.TransactionView> list(Long branchId, Long patientId) {
    return db
        .queryForList(
            "SELECT * FROM sales_transactions WHERE (?::bigint IS NULL OR branch_id=?) AND"
                + " (?::bigint IS NULL OR patient_id=?) ORDER BY sold_at DESC, id DESC",
            branchId, branchId, patientId, patientId)
        .stream()
        .map(this::toView)
        .toList();
  }

  private CheckoutDtos.TransactionView toView(Map<String, Object> transaction) {
    long id = ((Number) transaction.get("id")).longValue();

    List<CheckoutDtos.LineItem> items =
        db
            .queryForList(
                "SELECT description_snapshot,quantity,total_amount,item_kind FROM sales_items"
                    + " WHERE sales_transaction_id=? ORDER BY id",
                id)
            .stream()
            .map(
                row ->
                    new CheckoutDtos.LineItem(
                        (String) row.get("description_snapshot"),
                        ((Number) row.get("quantity")).intValue(),
                        (BigDecimal) row.get("total_amount"),
                        (String) row.get("item_kind")))
            .toList();

    List<CheckoutDtos.CommissionLine> commission =
        db
            .queryForList(
                "SELECT commission_rule_id,rule_name_snapshot,staff_id,commission_type,amount FROM"
                    + " transaction_commissions WHERE sales_transaction_id=? ORDER BY id",
                id)
            .stream()
            .map(
                row ->
                    new CheckoutDtos.CommissionLine(
                        row.get("commission_rule_id") == null
                            ? null
                            : ((Number) row.get("commission_rule_id")).longValue(),
                        (String) row.get("rule_name_snapshot"),
                        ((Number) row.get("staff_id")).longValue(),
                        (String) row.get("commission_type"),
                        (BigDecimal) row.get("amount")))
            .toList();

    // The course impact is read back from the ledger rather than stored twice.
    List<CheckoutDtos.CourseImpact> courseImpact = new ArrayList<>();
    for (Map<String, Object> entry :
        db.queryForList(
            "SELECT e.entry_type,e.quantity,pc.package_name_snapshot FROM course_ledger_entries e"
                + " JOIN patient_courses pc ON pc.id=e.patient_course_id WHERE"
                + " e.related_transaction_id=? ORDER BY e.id",
            id)) {
      String label =
          entry.get("package_name_snapshot")
              + " — "
              + switch ((String) entry.get("entry_type")) {
                case "PURCHASE" -> "Purchase";
                case "BONUS" -> "Bonus";
                case "TREATMENT" -> "Treatment";
                case "VOID_REVERSAL" -> "Void reversal";
                default -> (String) entry.get("entry_type");
              };
      courseImpact.add(
          new CheckoutDtos.CourseImpact(label, ((Number) entry.get("quantity")).intValue()));
    }

    // The cash figures live on the payment row, not the transaction, and are
    // present only for a cash receipt.
    List<Map<String, Object>> cashRows =
        db.queryForList(
            "SELECT cash_received,change_given FROM payments WHERE sales_transaction_id=?"
                + " AND cash_received IS NOT NULL ORDER BY id DESC LIMIT 1",
            id);
    BigDecimal cashReceived =
        cashRows.isEmpty() ? null : (BigDecimal) cashRows.get(0).get("cash_received");
    BigDecimal changeGiven =
        cashRows.isEmpty() ? null : (BigDecimal) cashRows.get(0).get("change_given");

    CheckoutDtos.VoidInfo voidInfo = null;
    if ("CANCELLED".equals(transaction.get("status"))) {
      List<Map<String, Object>> cancellations =
          db.queryForList(
              "SELECT c.reason_text,c.cancelled_at,COALESCE(NULLIF(trim(s.name),''),"
                  + " trim(u.first_name || ' ' || u.last_name),'System') AS actor"
                  + " FROM transaction_cancellations c"
                  + " LEFT JOIN users u ON u.id=c.cancelled_by"
                  + " LEFT JOIN staff s ON s.user_id=u.id AND s.deleted_at IS NULL"
                  + " WHERE c.transaction_id=? ORDER BY c.id DESC LIMIT 1",
              id);
      if (!cancellations.isEmpty()) {
        Map<String, Object> cancellation = cancellations.get(0);
        voidInfo =
            new CheckoutDtos.VoidInfo(
                (String) cancellation.get("actor"),
                iso(cancellation.get("cancelled_at")),
                (String) cancellation.get("reason_text"));
      }
    }

    return new CheckoutDtos.TransactionView(
        id,
        (String) transaction.get("transaction_no"),
        iso(transaction.get("sold_at")),
        ((Number) transaction.get("patient_id")).longValue(),
        ((Number) transaction.get("branch_id")).longValue(),
        asLong(transaction.get("appointment_id")),
        (String) transaction.get("transaction_type"),
        items,
        (BigDecimal) transaction.get("subtotal"),
        (BigDecimal) transaction.get("total_amount"),
        asLong(transaction.get("payment_method_id")),
        cashReceived,
        changeGiven,
        asLong(transaction.get("treating_staff_id")),
        asLong(transaction.get("salesperson_id")),
        "CANCELLED".equals(transaction.get("status")) ? "VOID" : "COMPLETED",
        courseImpact,
        commission,
        asLong(transaction.get("patient_course_id")),
        voidInfo);
  }

  /** Course balance and its full history, for the course detail and report screens. */
  public Map<String, Object> courseLedger(Long patientId, Long branchId) {
    Map<String, Object> result = new LinkedHashMap<>();
    String courseSql;
    Object[] courseArgs;
    if (patientId == null) {
      // The unscoped list is used by course reports and shows each course once,
      // using the owner's balance as the display balance.
      courseSql =
          "SELECT pc.id,pc.course_id,pc.patient_id,pc.package_id,pc.package_name_snapshot,"
              + "pc.sale_date,pc.valid_until,pc.total_visits,pc.bonus_visits,pc.visits_used,"
              + "pc.transfer_in_visits,pc.transfer_out_visits,pc.branch_id,pc.status"
              + " FROM patient_courses pc WHERE (?::bigint IS NULL OR pc.branch_id=?) ORDER BY pc.id";
      courseArgs = new Object[] {branchId, branchId};
    } else {
      // A patient-scoped list must include both the owner and shared members;
      // the balance columns are per patient, not just the course owner.
      courseSql =
          "SELECT pc.id,pc.course_id,cmb.patient_id,pc.package_id,pc.package_name_snapshot,"
              + "pc.sale_date,pc.valid_until,cmb.allocated_visits AS total_visits,"
              + "CASE WHEN cmb.patient_id=pc.patient_id THEN pc.bonus_visits ELSE 0 END AS bonus_visits,"
              + "cmb.used_visits,CASE WHEN cmb.patient_id=pc.patient_id THEN pc.transfer_in_visits ELSE 0 END AS transfer_in_visits,"
              + "CASE WHEN cmb.patient_id=pc.patient_id THEN pc.transfer_out_visits ELSE 0 END AS transfer_out_visits,"
              + "pc.branch_id,pc.status FROM patient_courses pc JOIN course_member_balances cmb"
              + " ON cmb.patient_course_id=pc.id WHERE cmb.patient_id=?"
              + " AND (?::bigint IS NULL OR pc.branch_id=?) ORDER BY pc.id";
      courseArgs = new Object[] {patientId, branchId, branchId};
    }
    result.put("patientCourses", db.queryForList(courseSql, courseArgs));
    String ledgerSql;
    Object[] ledgerArgs;
    if (patientId == null) {
      ledgerSql =
          "SELECT e.id,e.patient_course_id,e.entry_type,e.quantity,e.balance_after,e.branch_id,"
              + "e.related_transaction_id,e.transfer_group_id,e.counterparty_patient_id,"
              + "e.performed_by_name,e.created_at FROM course_ledger_entries e JOIN"
              + " patient_courses pc ON pc.id=e.patient_course_id WHERE (?::bigint IS NULL OR"
              + " pc.patient_id=?) AND (?::bigint IS NULL OR pc.branch_id=?) ORDER BY e.id";
      ledgerArgs = new Object[] {null, null, branchId, branchId};
    } else {
      ledgerSql =
          "SELECT e.id,e.patient_course_id,e.entry_type,e.quantity,e.balance_after,e.branch_id,"
              + "e.related_transaction_id,e.transfer_group_id,e.counterparty_patient_id,"
              + "e.performed_by_name,e.created_at FROM course_ledger_entries e JOIN"
              + " patient_courses pc ON pc.id=e.patient_course_id JOIN course_member_balances cmb"
              + " ON cmb.patient_course_id=e.patient_course_id WHERE cmb.patient_id=?"
              + " AND (?::bigint IS NULL OR pc.branch_id=?) ORDER BY e.id";
      ledgerArgs = new Object[] {patientId, branchId, branchId};
    }
    result.put(
        "ledger",
        db.queryForList(ledgerSql, ledgerArgs));
    return result;
  }

  private static Long asLong(Object value) {
    return value == null ? null : ((Number) value).longValue();
  }

  private static String iso(Object timestamp) {
    if (timestamp == null) return null;
    if (timestamp instanceof Timestamp t) return t.toInstant().toString();
    if (timestamp instanceof java.time.OffsetDateTime o) return o.toInstant().toString();
    return timestamp.toString();
  }
}
