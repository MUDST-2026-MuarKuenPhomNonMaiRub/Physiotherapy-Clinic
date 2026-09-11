package com.physiocare.clinic.commission;

import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Adding or removing a member on an existing course. This is deliberately
 * separate from {@code course-transfers} (which spins up a brand-new,
 * independent patient_course for the recipient): a Shared Course keeps one
 * course_id, one commission pool, one locked rate — members just draw down
 * the same balance. Nothing here ever creates a sale or a commission pool.
 */
@Service
public class SharedCourseService {
  private final JdbcTemplate db;

  public SharedCourseService(JdbcTemplate db) {
    this.db = db;
  }

  @Transactional
  public void addMember(long patientCourseId, long newPatientId, int visitsFromOwner) {
    Map<String, Object> course =
        db.queryForMap("SELECT patient_id FROM patient_courses WHERE id=? FOR UPDATE", patientCourseId);
    long ownerPatientId = ((Number) course.get("patient_id")).longValue();
    if (ownerPatientId == newPatientId)
      throw new IllegalArgumentException("That patient already owns this course");

    Map<String, Object> ownerBalance =
        db.queryForMap(
            "SELECT * FROM course_member_balances WHERE patient_course_id=? AND patient_id=? FOR"
                + " UPDATE",
            patientCourseId,
            ownerPatientId);
    int ownerRemaining = intOf(ownerBalance, "allocated_visits") - intOf(ownerBalance, "used_visits");
    if (visitsFromOwner <= 0 || visitsFromOwner > ownerRemaining)
      throw new IllegalArgumentException("Not enough remaining sessions on this course to share");

    db.update(
        "UPDATE course_member_balances SET allocated_visits=allocated_visits-?,updated_at=now() WHERE"
            + " patient_course_id=? AND patient_id=?",
        visitsFromOwner,
        patientCourseId,
        ownerPatientId);
    db.update(
        "INSERT INTO shared_course_members(patient_course_id,patient_id,role,status)"
            + " VALUES(?,?,'SHARED_MEMBER','ACTIVE') ON CONFLICT(patient_course_id,patient_id) DO"
            + " UPDATE SET status='ACTIVE'",
        patientCourseId,
        newPatientId);
    db.update(
        "INSERT INTO course_member_balances(patient_course_id,patient_id,allocated_visits)"
            + " VALUES(?,?,?) ON CONFLICT(patient_course_id,patient_id) DO UPDATE SET"
            + " allocated_visits=course_member_balances.allocated_visits+EXCLUDED.allocated_visits,"
            + " updated_at=now()",
        patientCourseId,
        newPatientId,
        visitsFromOwner);
  }

  /** Unused sessions return to the owner's balance; used ones stay recorded against the member. */
  @Transactional
  public void removeMember(long patientCourseId, long patientId) {
    Map<String, Object> course =
        db.queryForMap("SELECT patient_id FROM patient_courses WHERE id=? FOR UPDATE", patientCourseId);
    long ownerPatientId = ((Number) course.get("patient_id")).longValue();
    if (ownerPatientId == patientId)
      throw new IllegalArgumentException("The course owner cannot be removed as a member");

    Map<String, Object> balance =
        db.queryForMap(
            "SELECT * FROM course_member_balances WHERE patient_course_id=? AND patient_id=? FOR"
                + " UPDATE",
            patientCourseId,
            patientId);
    int unused = intOf(balance, "allocated_visits") - intOf(balance, "used_visits");
    if (unused > 0) {
      db.update(
          "UPDATE course_member_balances SET allocated_visits=allocated_visits-?,updated_at=now()"
              + " WHERE patient_course_id=? AND patient_id=?",
          unused,
          patientCourseId,
          patientId);
      db.update(
          "UPDATE course_member_balances SET allocated_visits=allocated_visits+?,updated_at=now()"
              + " WHERE patient_course_id=? AND patient_id=?",
          unused,
          patientCourseId,
          ownerPatientId);
    }
    db.update(
        "UPDATE shared_course_members SET status='REMOVED' WHERE patient_course_id=? AND patient_id=?",
        patientCourseId,
        patientId);
  }

  public List<Map<String, Object>> listMembers(long patientCourseId) {
    return db.queryForList(
        "SELECT scm.patient_id, p.hn, p.first_name_th, p.last_name_th, scm.role, scm.status,"
            + " COALESCE(cmb.allocated_visits,0) AS allocated_visits, COALESCE(cmb.used_visits,0) AS"
            + " used_visits FROM shared_course_members scm JOIN patients p ON p.id=scm.patient_id LEFT"
            + " JOIN course_member_balances cmb ON cmb.patient_course_id=scm.patient_course_id AND"
            + " cmb.patient_id=scm.patient_id WHERE scm.patient_course_id=? ORDER BY scm.role DESC,"
            + " p.first_name_th",
        patientCourseId);
  }

  private static int intOf(Map<String, Object> row, String column) {
    Object value = row.get(column);
    return value == null ? 0 : ((Number) value).intValue();
  }
}
