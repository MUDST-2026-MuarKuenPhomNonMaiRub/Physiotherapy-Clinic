package com.physiocare.clinic.common;

import java.time.Year;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/** Generates human-readable document numbers without concurrent count races. */
@Service
public class DocumentNumberService {
  private final JdbcTemplate db;

  public DocumentNumberService(JdbcTemplate db) { this.db = db; }

  public String next(String prefix, String table, String column) {
    db.queryForList("SELECT pg_advisory_xact_lock(hashtext(?))", Object.class, table + ":" + column);
    Long next = db.queryForObject("SELECT count(*)+1 FROM " + table, Long.class);
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
