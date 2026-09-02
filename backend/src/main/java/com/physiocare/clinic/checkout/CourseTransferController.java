package com.physiocare.clinic.checkout;

import com.physiocare.clinic.common.BranchAccessService;
import com.physiocare.clinic.common.CurrentUser;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Positive;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

/**
 * Moves remaining sessions from one patient's course to another. Both sides get
 * a ledger entry sharing one transfer group, so the report can show who gave
 * what to whom, when, and who keyed it in.
 */
@RestController
@RequestMapping("/api/v1/course-transfers")
public class CourseTransferController {
  private final JdbcTemplate db;
  private final CheckoutService checkout;
  private final BranchAccessService branches;
  private final CurrentUser currentUser;

  public CourseTransferController(
      JdbcTemplate db,
      CheckoutService checkout,
      BranchAccessService branches,
      CurrentUser currentUser) {
    this.db = db;
    this.checkout = checkout;
    this.branches = branches;
    this.currentUser = currentUser;
  }

  public record TransferRequest(
      @Positive long patientCourseId,
      @Positive long toPatientId,
      @Positive int sessions,
      String reason) {}

  @GetMapping
  public List<Map<String, Object>> list(@RequestParam(required = false) Long branchId) {
    return db.queryForList(
        "SELECT t.id,t.transfer_no,t.patient_course_id,t.to_patient_course_id,t.from_patient_id,"
            + "t.to_patient_id,t.quantity,t.reason,t.created_at,pc.branch_id FROM course_transfers t"
            + " JOIN patient_courses pc ON pc.id=t.patient_course_id WHERE (?::bigint IS NULL"
            + " OR pc.branch_id=?) ORDER BY t.id DESC",
        branchId, branchId);
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  @PreAuthorize("hasAnyRole('ADMIN','PHYSIO','RECEPTIONIST')")
  @Transactional
  public Map<String, Object> transfer(
      @Valid @RequestBody TransferRequest r, Authentication authentication) {
    Map<String, Object> source = checkout.lockPatientCourse(r.patientCourseId());
    long fromPatientId = ((Number) source.get("patient_id")).longValue();
    if (fromPatientId == r.toPatientId())
      throw new IllegalArgumentException("A course cannot be transferred to its own owner");

    Long branchId = source.get("branch_id") == null ? null : ((Number) source.get("branch_id")).longValue();
    if (branchId == null) throw new IllegalArgumentException("This course has no branch");
    branches.requireAccess(authentication, branchId);

    if (CheckoutService.remaining(source) < r.sessions())
      throw new IllegalArgumentException("Not enough sessions remaining to transfer");

    long packageId = ((Number) source.get("package_id")).longValue();
    String actor = currentUser.displayName(authentication);
    Long actorUserId = currentUser.id(authentication);
    String transferGroupId = checkout.nextNumber("TRF", "course_transfers", "transfer_no");

    db.update(
        "UPDATE patient_courses SET transfer_out_visits=transfer_out_visits+? WHERE id=?",
        r.sessions(), r.patientCourseId());
    checkout.addLedgerEntry(
        r.patientCourseId(), "TRANSFER_OUT", -r.sessions(),
        CheckoutService.remaining(checkout.patientCourse(r.patientCourseId())), branchId, null,
        actor, actorUserId, transferGroupId, null);
    db.update(
        "UPDATE course_ledger_entries SET counterparty_patient_id=? WHERE id=(SELECT max(id) FROM"
            + " course_ledger_entries WHERE patient_course_id=?)",
        r.toPatientId(), r.patientCourseId());
    checkout.refreshCourseStatus(r.patientCourseId());

    // Sessions land on the recipient's live course for the same package when
    // they already have one, so their balance stays in a single place.
    List<Map<String, Object>> existing =
        db.queryForList(
            "SELECT id FROM patient_courses WHERE patient_id=? AND package_id=? AND"
                + " status='ACTIVE' ORDER BY id LIMIT 1",
            r.toPatientId(), packageId);

    long targetId;
    if (existing.isEmpty()) {
      targetId =
          db.queryForObject(
              "INSERT INTO patient_courses(course_id,patient_id,package_id,"
                  + "package_name_snapshot,sale_date,sale_month,course_price,total_visits,"
                  + "bonus_visits,transfer_in_visits,branch_id,valid_until,status)"
                  + " VALUES(?,?,?,?,?,date_trunc('month',?::date),0,0,0,?,?,?,'ACTIVE')"
                  + " RETURNING id",
              Long.class,
              checkout.nextNumber("PC", "patient_courses", "course_id"),
              r.toPatientId(),
              packageId,
              source.get("package_name_snapshot"),
              LocalDate.now(),
              LocalDate.now(),
              r.sessions(),
              branchId,
              source.get("valid_until"));
    } else {
      targetId = ((Number) existing.get(0).get("id")).longValue();
      checkout.lockPatientCourse(targetId);
      db.update(
          "UPDATE patient_courses SET transfer_in_visits=transfer_in_visits+? WHERE id=?",
          r.sessions(), targetId);
    }

    checkout.addLedgerEntry(
        targetId, "TRANSFER_IN", r.sessions(),
        CheckoutService.remaining(checkout.patientCourse(targetId)), branchId, null, actor,
        actorUserId, transferGroupId, null);
    db.update(
        "UPDATE course_ledger_entries SET counterparty_patient_id=? WHERE id=(SELECT max(id) FROM"
            + " course_ledger_entries WHERE patient_course_id=?)",
        fromPatientId, targetId);
    checkout.refreshCourseStatus(targetId);

    long transferId =
        db.queryForObject(
            "INSERT INTO course_transfers(transfer_no,patient_course_id,to_patient_course_id,"
                + "from_patient_id,to_patient_id,quantity,reason,created_by)"
                + " VALUES(?,?,?,?,?,?,?,?) RETURNING id",
            Long.class,
            transferGroupId, r.patientCourseId(), targetId, fromPatientId, r.toPatientId(),
            r.sessions(), r.reason(), actorUserId);

    return db.queryForMap(
        "SELECT id,transfer_no,patient_course_id,to_patient_course_id,from_patient_id,"
            + "to_patient_id,quantity,reason,created_at FROM course_transfers WHERE id=?",
        transferId);
  }
}
