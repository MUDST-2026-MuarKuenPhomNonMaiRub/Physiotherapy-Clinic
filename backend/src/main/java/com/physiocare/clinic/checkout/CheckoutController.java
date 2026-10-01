package com.physiocare.clinic.checkout;

import com.physiocare.clinic.common.BranchAccessService;
import com.physiocare.clinic.common.PageResponse;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
public class CheckoutController {
  private final CheckoutService checkout;
  private final TransactionReader reader;
  private final BranchAccessService branches;

  public CheckoutController(
      CheckoutService checkout, TransactionReader reader, BranchAccessService branches) {
    this.checkout = checkout;
    this.reader = reader;
    this.branches = branches;
  }

  @PostMapping("/checkout")
  @ResponseStatus(HttpStatus.CREATED)
  @PreAuthorize("@permissionGuard.hasAny(authentication, 'checkout.create')")
  public CheckoutDtos.TransactionView checkout(
      @Valid @RequestBody CheckoutDtos.CheckoutRequest request, Authentication authentication) {
    return checkout.checkout(request, authentication);
  }

  @GetMapping("/transactions")
  @PreAuthorize("@permissionGuard.hasAny(authentication, 'transaction.view')")
  public List<CheckoutDtos.TransactionView> list(
      @RequestParam(required = false) Long branchId,
      @RequestParam(required = false) Long patientId,
      @RequestParam(defaultValue = "200") int limit,
      Authentication authentication) {
    branches.requireFilter(authentication, branchId);
    return reader.list(branchId, patientId, Math.min(Math.max(limit, 1), 1000));
  }

  @GetMapping("/transactions/page")
  @PreAuthorize("@permissionGuard.hasAny(authentication, 'transaction.view')")
  public PageResponse<CheckoutDtos.TransactionView> page(
      @RequestParam(required = false) Long branchId,
      @RequestParam(required = false) Long patientId,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "50") int size,
      Authentication authentication) {
    branches.requireFilter(authentication, branchId);
    return reader.page(branchId, patientId, page, size);
  }

  @GetMapping("/transactions/{id}")
  @PreAuthorize("@permissionGuard.hasAny(authentication, 'transaction.view')")
  public CheckoutDtos.TransactionView get(@PathVariable long id, Authentication authentication) {
    CheckoutDtos.TransactionView transaction = reader.get(id);
    branches.requireAccess(authentication, transaction.branchId());
    return transaction;
  }

  /** Voiding reverses money and course balances, so it stays with the admins. */
  @PostMapping("/transactions/{id}/void")
  @PreAuthorize("@permissionGuard.hasAny(authentication, 'transaction.void')")
  public CheckoutDtos.TransactionView voidTransaction(
      @PathVariable long id,
      @Valid @RequestBody CheckoutDtos.VoidRequest request,
      Authentication authentication) {
    return checkout.voidTransaction(id, request.reason(), authentication);
  }

  @GetMapping("/patient-courses")
  @PreAuthorize("@permissionGuard.hasAny(authentication, 'course.view', 'course.use', 'checkout.create')")
  public Map<String, Object> courses(
      @RequestParam(required = false) Long patientId,
      @RequestParam(required = false) Long branchId,
      @RequestParam(defaultValue = "200") int limit,
      Authentication authentication) {
    branches.requireFilter(authentication, branchId);
    return reader.courseLedger(patientId, branchId, Math.min(Math.max(limit, 1), 1000));
  }

  @GetMapping("/patient-courses/page")
  @PreAuthorize("@permissionGuard.hasAny(authentication, 'course.view', 'course.use', 'checkout.create')")
  public PageResponse<Map<String, Object>> coursePage(
      @RequestParam(required = false) Long branchId,
      @RequestParam(defaultValue = "") String search,
      @RequestParam(defaultValue = "") String courseId,
      @RequestParam(defaultValue = "") String status,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "10") int size,
      Authentication authentication) {
    branches.requireFilter(authentication, branchId);
    return reader.coursePage(branchId, search, courseId, status, page, size);
  }

  @GetMapping("/patient-courses/ledger/page")
  @PreAuthorize("@permissionGuard.hasAny(authentication, 'course.view', 'course.use', 'checkout.create')")
  public PageResponse<Map<String, Object>> ledgerPage(
      @RequestParam(required = false) Long branchId,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "100") int size,
      Authentication authentication) {
    branches.requireFilter(authentication, branchId);
    return reader.ledgerPage(branchId, page, size);
  }
}
