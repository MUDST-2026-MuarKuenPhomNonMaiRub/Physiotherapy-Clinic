package com.physiocare.clinic.commission;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/**
 * The one place that writes to {@code audit_logs}. Before this, the table
 * existed from V5 but nothing ever wrote to it — every action here is
 * something Finance needs a trail for: a tier configuration change, a
 * closed-month rate override, a treatment-fee-rule edit.
 */
@Service
public class CommissionAuditService {
  private final JdbcTemplate db;
  private final ObjectMapper mapper;

  public CommissionAuditService(JdbcTemplate db, ObjectMapper mapper) {
    this.db = db;
    this.mapper = mapper;
  }

  public void record(
      Long actorUserId,
      Long branchId,
      String action,
      String entityType,
      String entityId,
      Object before,
      Object after,
      String reason) {
    db.update(
        "INSERT INTO audit_logs(actor_user_id,branch_id,action,entity_type,entity_id,before_data,"
            + "after_data,reason) VALUES(?,?,?,?,?,?::jsonb,?::jsonb,?)",
        actorUserId,
        branchId,
        action,
        entityType,
        entityId,
        toJson(before),
        toJson(after),
        reason);
  }

  private String toJson(Object value) {
    if (value == null) return null;
    try {
      return mapper.writeValueAsString(value);
    } catch (Exception e) {
      return "{\"error\":\"could not serialize\"}";
    }
  }
}
