package com.physiocare.clinic.common;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/** Single application entry point for the append-only audit log. */
@Service
public class AuditService {
  private final JdbcTemplate db;
  private final ObjectMapper mapper;

  public AuditService(JdbcTemplate db, ObjectMapper mapper) {
    this.db = db;
    this.mapper = mapper;
  }

  public void record(Long actorUserId, Long branchId, String action, String entityType,
      String entityId, Object before, Object after, String reason) {
    db.update(
        "INSERT INTO audit_logs(actor_user_id,branch_id,action,entity_type,entity_id,before_data,"
            + "after_data,reason) VALUES(?,?,?,?,?,?::jsonb,?::jsonb,?)",
        actorUserId, branchId, action, entityType, entityId, json(before), json(after), reason);
  }

  private String json(Object value) {
    if (value == null) return null;
    try {
      return mapper.writeValueAsString(value);
    } catch (Exception e) {
      return "{\"error\":\"could not serialize\"}";
    }
  }
}
