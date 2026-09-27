package com.physiocare.clinic.checkout;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import com.physiocare.clinic.common.PageResponse;
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
    return toView(rows.get(0), loadRelatedData(List.of(id)));
  }

  public List<CheckoutDtos.TransactionView> list(Long branchId, Long patientId, int limit) {
    List<Map<String, Object>> rows = db.queryForList(
            "SELECT * FROM sales_transactions WHERE (?::bigint IS NULL OR branch_id=?) AND"
                + " (?::bigint IS NULL OR patient_id=?) ORDER BY sold_at DESC, id DESC LIMIT ?",
            branchId, branchId, patientId, patientId, limit);
    List<Long> ids = rows.stream().map(row -> ((Number) row.get("id")).longValue()).toList();
    RelatedData related = loadRelatedData(ids);
    return rows.stream().map(row -> toView(row, related)).toList();
  }

  public PageResponse<CheckoutDtos.TransactionView> page(Long branchId, Long patientId,
      int requestedPage, int requestedSize) {
    int size = PageResponse.size(requestedSize);
    int page = Math.max(requestedPage, 0);
    String where = " FROM sales_transactions WHERE (?::bigint IS NULL OR branch_id=?) AND"
        + " (?::bigint IS NULL OR patient_id=?)";
    long total = db.queryForObject("SELECT count(*)" + where, Long.class,
        branchId, branchId, patientId, patientId);
    List<Map<String, Object>> rows = db.queryForList(
        "SELECT *" + where + " ORDER BY sold_at DESC, id DESC LIMIT ? OFFSET ?",
        branchId, branchId, patientId, patientId, size, PageResponse.offset(page, size));
    RelatedData related = loadRelatedData(rows.stream().map(row -> ((Number) row.get("id")).longValue()).toList());
    List<CheckoutDtos.TransactionView> items = rows.stream().map(row -> toView(row, related)).toList();
    return PageResponse.of(items, page, size, total);
  }

  private CheckoutDtos.TransactionView toView(Map<String, Object> transaction) {
    long id = ((Number) transaction.get("id")).longValue();
    return toView(transaction, loadRelatedData(List.of(id)));
  }

  private CheckoutDtos.TransactionView toView(Map<String, Object> transaction, RelatedData related) {
    long id = ((Number) transaction.get("id")).longValue();

    List<CheckoutDtos.LineItem> items =
        related.items().getOrDefault(id, List.of())
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
        related.commission().getOrDefault(id, List.of())
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
    for (Map<String, Object> entry : related.courseImpact().getOrDefault(id, List.of())) {
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
    List<Map<String, Object>> cashRows = related.payments().getOrDefault(id, List.of());
    BigDecimal cashReceived =
        cashRows.isEmpty() ? null : (BigDecimal) cashRows.get(0).get("cash_received");
    BigDecimal changeGiven =
        cashRows.isEmpty() ? null : (BigDecimal) cashRows.get(0).get("change_given");

    CheckoutDtos.VoidInfo voidInfo = null;
    if ("CANCELLED".equals(transaction.get("status"))) {
      List<Map<String, Object>> cancellations = related.cancellations().getOrDefault(id, List.of());
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

  private record RelatedData(
      Map<Long, List<Map<String, Object>>> items,
      Map<Long, List<Map<String, Object>>> commission,
      Map<Long, List<Map<String, Object>>> courseImpact,
      Map<Long, List<Map<String, Object>>> payments,
      Map<Long, List<Map<String, Object>>> cancellations) {}

  private RelatedData loadRelatedData(List<Long> ids) {
    if (ids.isEmpty()) return new RelatedData(Map.of(), Map.of(), Map.of(), Map.of(), Map.of());
    String placeholders = ids.stream().map(id -> "?").collect(Collectors.joining(","));
    Object[] args = ids.toArray();
    Map<Long, List<Map<String, Object>>> items = groupById(db.queryForList(
        "SELECT sales_transaction_id,description_snapshot,quantity,total_amount,item_kind FROM sales_items"
            + " WHERE sales_transaction_id IN (" + placeholders + ") ORDER BY id", args));
    Map<Long, List<Map<String, Object>>> commission = groupById(db.queryForList(
        "SELECT sales_transaction_id,commission_rule_id,rule_name_snapshot,staff_id,commission_type,amount"
            + " FROM transaction_commissions WHERE sales_transaction_id IN (" + placeholders + ") ORDER BY id", args));
    Map<Long, List<Map<String, Object>>> courseImpact = groupById(db.queryForList(
        "SELECT e.related_transaction_id,e.entry_type,e.quantity,pc.package_name_snapshot FROM course_ledger_entries e"
            + " JOIN patient_courses pc ON pc.id=e.patient_course_id WHERE e.related_transaction_id IN (" + placeholders + ") ORDER BY e.id", args));
    Map<Long, List<Map<String, Object>>> payments = groupById(db.queryForList(
        "SELECT sales_transaction_id,cash_received,change_given FROM payments WHERE sales_transaction_id IN (" + placeholders + ")"
            + " AND cash_received IS NOT NULL ORDER BY id DESC", args));
    Map<Long, List<Map<String, Object>>> cancellations = groupById(db.queryForList(
        "SELECT c.transaction_id,c.reason_text,c.cancelled_at,COALESCE(NULLIF(trim(s.name),''),"
            + " trim(u.first_name || ' ' || u.last_name),'System') AS actor FROM transaction_cancellations c"
            + " LEFT JOIN users u ON u.id=c.cancelled_by LEFT JOIN staff s ON s.user_id=u.id AND s.deleted_at IS NULL"
            + " WHERE c.transaction_id IN (" + placeholders + ") ORDER BY c.id DESC", args));
    return new RelatedData(items, commission, courseImpact, payments, cancellations);
  }

  private Map<Long, List<Map<String, Object>>> groupById(List<Map<String, Object>> rows) {
    Map<Long, List<Map<String, Object>>> grouped = new HashMap<>();
    for (Map<String, Object> row : rows) {
      Object value = row.get("sales_transaction_id");
      if (value == null) value = row.get("related_transaction_id");
      if (value == null) value = row.get("transaction_id");
      grouped.computeIfAbsent(((Number) value).longValue(), ignored -> new ArrayList<>()).add(row);
    }
    return grouped;
  }

  /** Course balance and its full history, for the course detail and report screens. */
  public Map<String, Object> courseLedger(Long patientId, Long branchId, int limit) {
    Map<String, Object> result = new LinkedHashMap<>();
    // One row per person holding sessions on a course: the owner, and anyone
    // sessions were transferred to. Each row carries that person's own
    // balance so purchased + bonus + transfer-in - used - transfer-out is what
    // they can still spend. A transfer moves sessions inside the same course
    // (the recipient becomes a member), so the owner's row shows the
    // transfer-out and the recipient's row shows it as transfer-in.
    String courseSql =
        "SELECT pc.id,pc.course_id,cmb.patient_id,pc.patient_id AS owner_patient_id,pc.package_id,"
            + "pc.package_name_snapshot,pc.sale_date,pc.valid_until,"
            + "CASE WHEN cmb.patient_id=pc.patient_id THEN pc.total_visits ELSE 0 END AS total_visits,"
            + "CASE WHEN cmb.patient_id=pc.patient_id THEN pc.bonus_visits ELSE 0 END AS bonus_visits,"
            + "cmb.used_visits AS visits_used,"
            + "CASE WHEN cmb.patient_id=pc.patient_id THEN 0 ELSE cmb.allocated_visits END AS transfer_in_visits,"
            + "CASE WHEN cmb.patient_id=pc.patient_id THEN pc.transfer_out_visits ELSE 0 END AS transfer_out_visits,"
            + "pc.branch_id,pc.status FROM patient_courses pc JOIN course_member_balances cmb"
            + " ON cmb.patient_course_id=pc.id WHERE (?::bigint IS NULL OR cmb.patient_id=?)"
            + " AND (?::bigint IS NULL OR pc.branch_id=?)"
            + " ORDER BY pc.id, (cmb.patient_id=pc.patient_id) DESC, cmb.patient_id LIMIT ?";
    Object[] courseArgs = new Object[] {patientId, patientId, branchId, branchId, limit};
    result.put("patientCourses", db.queryForList(courseSql, courseArgs));
    String ledgerSql;
    Object[] ledgerArgs;
    if (patientId == null) {
      ledgerSql =
          "SELECT e.id,e.patient_course_id,e.entry_type,e.quantity,e.balance_after,e.branch_id,"
              + "e.related_transaction_id,e.transfer_group_id,e.counterparty_patient_id,"
              + "e.performed_by_name,e.created_at FROM course_ledger_entries e JOIN"
              + " patient_courses pc ON pc.id=e.patient_course_id WHERE (?::bigint IS NULL OR"
              + " pc.patient_id=?) AND (?::bigint IS NULL OR pc.branch_id=?) ORDER BY e.id LIMIT ?";
      ledgerArgs = new Object[] {null, null, branchId, branchId, limit};
    } else {
      ledgerSql =
          "SELECT e.id,e.patient_course_id,e.entry_type,e.quantity,e.balance_after,e.branch_id,"
              + "e.related_transaction_id,e.transfer_group_id,e.counterparty_patient_id,"
              + "e.performed_by_name,e.created_at FROM course_ledger_entries e JOIN"
              + " patient_courses pc ON pc.id=e.patient_course_id JOIN course_member_balances cmb"
              + " ON cmb.patient_course_id=e.patient_course_id WHERE cmb.patient_id=?"
              + " AND (?::bigint IS NULL OR pc.branch_id=?) ORDER BY e.id LIMIT ?";
      ledgerArgs = new Object[] {patientId, branchId, branchId, limit};
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
