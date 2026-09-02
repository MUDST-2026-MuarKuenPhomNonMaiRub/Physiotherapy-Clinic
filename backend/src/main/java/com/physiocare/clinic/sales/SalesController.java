package com.physiocare.clinic.sales;

import com.physiocare.clinic.commission.CommissionDtos;
import com.physiocare.clinic.commission.CommissionService;
import com.physiocare.clinic.common.BranchAccessService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/sales")
public class SalesController {
  private final JdbcTemplate db;
  private final CommissionService commissions;
  private final BranchAccessService branches;

  public SalesController(
      JdbcTemplate db, CommissionService commissions, BranchAccessService branches) {
    this.db = db;
    this.commissions = commissions;
    this.branches = branches;
  }

  public record SaleRequest(
      @Positive long patientId,
      @Positive long branchId,
      @Positive long packageId,
      @Positive long sellerEmployeeId,
      @Positive long caseOwnerEmployeeId,
      @NotNull @DecimalMin("0") BigDecimal amount,
      @Positive int visits) {}

  public record PaymentRequest(
      @Positive long salesTransactionId,
      @Positive long paymentMethodId,
      @NotNull @DecimalMin("0.01") BigDecimal amount,
      String referenceNo) {}

  @PostMapping("/courses")
  @ResponseStatus(HttpStatus.CREATED)
  @PreAuthorize("hasAnyRole('ADMIN','RECEPTIONIST','FINANCE')")
  @Transactional
  public Object createCourseSale(@Valid @RequestBody SaleRequest r, Authentication authentication) {
    branches.requireAccess(authentication, r.branchId());
    branches.requireActiveBranch(r.branchId());
    String no = "RE-" + System.currentTimeMillis();
    long tx =
        db.queryForObject(
            "INSERT INTO"
                + " sales_transactions(transaction_no,patient_id,branch_id,transaction_type,status,subtotal,total_amount,salesperson_id)"
                + " VALUES(?,?,?,'COURSE','CONFIRMED',?,?,?) RETURNING id",
            Long.class,
            no,
            r.patientId(),
            r.branchId(),
            r.amount(),
            r.amount(),
            r.sellerEmployeeId());
    db.update(
        "INSERT INTO"
            + " sales_items(sales_transaction_id,item_type,course_id,description_snapshot,quantity,unit_price,total_amount)"
            + " SELECT ?,'COURSE',id,name_th,1,?,? FROM courses WHERE id=?",
        tx,
        r.amount(),
        r.amount(),
        r.packageId());
    commissions.createCourse(
        new CommissionDtos.CreateCourseRequest(
            no,
            no,
            tx,
            r.patientId(),
            r.packageId(),
            r.sellerEmployeeId(),
            r.caseOwnerEmployeeId(),
            r.amount(),
            r.visits(),
            java.time.LocalDate.now()));
    return db.queryForMap("SELECT * FROM sales_transactions WHERE id=?", tx);
  }

  @PostMapping("/payments")
  @ResponseStatus(HttpStatus.CREATED)
  @PreAuthorize("hasAnyRole('ADMIN','RECEPTIONIST','FINANCE')")
  @Transactional
  public Object pay(@Valid @RequestBody PaymentRequest r) {
    Map<String, Object> sale =
        db.queryForMap(
            "SELECT total_amount,status FROM sales_transactions WHERE id=? FOR UPDATE",
            r.salesTransactionId());
    if ("CANCELLED".equals(sale.get("status")))
      throw new IllegalArgumentException("Cannot pay a cancelled transaction");
    BigDecimal paid =
        db.queryForObject(
            "SELECT COALESCE(sum(amount),0) FROM payments WHERE sales_transaction_id=? AND"
                + " status='PAID'",
            BigDecimal.class,
            r.salesTransactionId());
    BigDecimal total = (BigDecimal) sale.get("total_amount");
    if (paid.add(r.amount()).compareTo(total) > 0)
      throw new IllegalArgumentException("Payment exceeds transaction total");
    String no = "PM-" + System.currentTimeMillis();
    long id =
        db.queryForObject(
            "INSERT INTO"
                + " payments(payment_no,sales_transaction_id,payment_method_id,amount,reference_no)"
                + " VALUES(?,?,?,?,?) RETURNING id",
            Long.class,
            no,
            r.salesTransactionId(),
            r.paymentMethodId(),
            r.amount(),
            r.referenceNo());
    db.update(
        "UPDATE sales_transactions SET status=CASE WHEN COALESCE((SELECT sum(amount) FROM payments"
            + " WHERE sales_transaction_id=? AND status='PAID'),0)>=total_amount THEN 'PAID' ELSE"
            + " 'PARTIALLY_PAID' END WHERE id=?",
        r.salesTransactionId(),
        r.salesTransactionId());
    return db.queryForMap("SELECT * FROM payments WHERE id=?", id);
  }

  @PostMapping("/{id}/cancel")
  @PreAuthorize("hasAnyRole('ADMIN','FINANCE')")
  @Transactional
  public Object cancel(@PathVariable long id, @RequestParam String reason) {
    db.update(
        "UPDATE sales_transactions SET status='CANCELLED',cancelled_at=now() WHERE id=? AND"
            + " status<>'CANCELLED'",
        id);
    db.update(
        "UPDATE patient_courses SET status='REFUNDED',commission_status='CANCELLED' WHERE"
            + " sales_transaction_id=? AND visits_used=0",
        id);
    db.update(
        "INSERT INTO transaction_cancellations(transaction_id,reason_code,reason_text)"
            + " VALUES(?,?,?)",
        id,
        "USER_REQUEST",
        reason);
    return db.queryForMap("SELECT * FROM sales_transactions WHERE id=?", id);
  }
}
