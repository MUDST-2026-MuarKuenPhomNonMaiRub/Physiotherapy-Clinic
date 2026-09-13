package com.physiocare.clinic.checkout;

import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Safe, repeatable repair for the pre-shared-course transfer implementation. */
@Service
public class LegacyTransferReconciliationService {
  private final JdbcTemplate db;
  public LegacyTransferReconciliationService(JdbcTemplate db) { this.db = db; }
  public record Report(int confident, int ambiguous, int mutated) {}

  @Transactional
  public Report reconcile(boolean dryRun) {
    int confident = 0, ambiguous = 0, mutated = 0;
    List<Map<String,Object>> rows = db.queryForList(
        "SELECT t.id transfer_id,t.patient_course_id source_id,t.to_patient_course_id duplicate_id,"
      + " t.to_patient_id recipient_id,s.package_id source_package,d.package_id duplicate_package,"
      + " d.sales_transaction_id duplicate_sale,d.status duplicate_status"
      + " FROM course_transfers t JOIN patient_courses s ON s.id=t.patient_course_id"
      + " JOIN patient_courses d ON d.id=t.to_patient_course_id"
      + " WHERE t.to_patient_course_id IS NOT NULL AND d.transfer_in_visits>0");
    for (Map<String,Object> r : rows) {
      long source = ((Number) r.get("source_id")).longValue();
      long duplicate = ((Number) r.get("duplicate_id")).longValue();
      boolean safe = r.get("duplicate_sale") == null
          && r.get("source_package").equals(r.get("duplicate_package"))
          && "ACTIVE".equals(r.get("duplicate_status"));
      int sameRecipient = db.queryForObject(
          "SELECT count(*) FROM patient_courses WHERE patient_id=? AND package_id=? AND id<>? AND status='ACTIVE' AND transfer_in_visits>0",
          Integer.class, r.get("recipient_id"), r.get("duplicate_package"), duplicate);
      if (!safe || sameRecipient > 0) { ambiguous++; continue; }
      confident++;
      if (dryRun) continue;
      int done = db.update("INSERT INTO legacy_transfer_reconciliations(transfer_id,source_course_id,duplicate_course_id) VALUES(?,?,?) ON CONFLICT(transfer_id) DO NOTHING", r.get("transfer_id"), source, duplicate);
      if (done == 0) continue;
      Map<String,Object> b = db.queryForMap("SELECT allocated_visits,used_visits FROM course_member_balances WHERE patient_course_id=? AND patient_id=? FOR UPDATE", duplicate, r.get("recipient_id"));
      db.update("INSERT INTO shared_course_members(patient_course_id,patient_id,role) VALUES(?,?,'MEMBER') ON CONFLICT DO NOTHING", source, r.get("recipient_id"));
      db.update("INSERT INTO course_member_balances(patient_course_id,patient_id,allocated_visits,used_visits) VALUES(?,?,?,?) ON CONFLICT(patient_course_id,patient_id) DO UPDATE SET allocated_visits=course_member_balances.allocated_visits+EXCLUDED.allocated_visits,used_visits=course_member_balances.used_visits+EXCLUDED.used_visits,updated_at=now()", source, r.get("recipient_id"), b.get("allocated_visits"), b.get("used_visits"));
      db.update("UPDATE course_member_balances SET allocated_visits=used_visits,updated_at=now() WHERE patient_course_id=? AND patient_id=?", duplicate, r.get("recipient_id"));
      db.update("UPDATE patient_courses SET status='RECONCILED' WHERE id=?", duplicate);
      mutated++;
    }
    return new Report(confident, ambiguous, mutated);
  }
}
