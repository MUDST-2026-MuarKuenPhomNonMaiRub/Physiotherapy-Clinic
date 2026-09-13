package com.physiocare.clinic.commission;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;

/** Read-only Finance/Admin view of the append-only commission audit trail. */
@Service
@PreAuthorize("hasAnyRole('ADMIN','FINANCE')")
public class CommissionAuditQueryService {
  private final JdbcTemplate db;

  public CommissionAuditQueryService(JdbcTemplate db) {
    this.db = db;
  }

  public List<Map<String, Object>> list(
      String entityType, String action, OffsetDateTime from, OffsetDateTime to) {
    return db.queryForList(
        "SELECT id,occurred_at,actor_user_id,branch_id,action,entity_type,entity_id,before_data,"
            + "after_data,reason,request_id FROM audit_logs WHERE (?::varchar IS NULL OR entity_type=?)"
            + " AND (?::varchar IS NULL OR action=?) AND (?::timestamptz IS NULL OR occurred_at>=?)"
            + " AND (?::timestamptz IS NULL OR occurred_at<=?) ORDER BY occurred_at DESC,id DESC",
        entityType,
        entityType,
        action,
        action,
        from,
        from,
        to,
        to);
  }
}
