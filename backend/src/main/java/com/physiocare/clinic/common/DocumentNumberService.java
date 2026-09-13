package com.physiocare.clinic.common;

import java.time.Year;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import java.util.Map;

/** Generates human-readable document numbers without concurrent count races. */
@Service
public class DocumentNumberService {
  private static final Map<String, String> SEQUENCES = Map.of(
      "sales_transactions:transaction_no", "sales_transaction_no_seq",
      "payments:payment_no", "payment_no_seq",
      "course_transfers:transfer_no", "course_transfer_no_seq",
      "patient_courses:course_id", "patient_course_no_seq");
  private final JdbcTemplate db;

  public DocumentNumberService(JdbcTemplate db) { this.db = db; }

  public String next(String prefix, String table, String column) {
    String sequence = SEQUENCES.get(table + ":" + column);
    if (sequence == null) throw new IllegalArgumentException("Unsupported document number type");
    Long next = db.queryForObject("SELECT nextval('" + sequence + "')", Long.class);
    String candidate = String.format("%s-%d-%06d", prefix, Year.now().getValue(), next);
    while (Boolean.TRUE.equals(db.queryForObject(
        "SELECT EXISTS(SELECT 1 FROM " + table + " WHERE " + column + "=?)",
        Boolean.class, candidate))) {
      next++;
      candidate = String.format("%s-%d-%06d", prefix, Year.now().getValue(), next);
    }
    return candidate;
  }
}
