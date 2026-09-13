package com.physiocare.clinic.commission;

import com.physiocare.clinic.common.AuditService;
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
  private final AuditService audit;

  public CommissionAuditService(AuditService audit) {
    this.audit = audit;
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
    audit.record(actorUserId, branchId, action, entityType, entityId, before, after, reason);
  }
}
