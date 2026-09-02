package com.physiocare.clinic.checkout;

import com.physiocare.clinic.common.BranchAccessService;
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
  @PreAuthorize("hasAnyRole('ADMIN','PHYSIO','RECEPTIONIST','FINANCE')")
  public CheckoutDtos.TransactionView checkout(
      @Valid @RequestBody CheckoutDtos.CheckoutRequest request, Authentication authentication) {
    return checkout.checkout(request, authentication);
  }

  @GetMapping("/transactions")
  public List<CheckoutDtos.TransactionView> list(
      @RequestParam(required = false) Long branchId,
      @RequestParam(required = false) Long patientId,
      Authentication authentication) {
    if (branchId != null) branches.requireAccess(authentication, branchId);
    return reader.list(branchId, patientId);
  }

  @GetMapping("/transactions/{id}")
  public CheckoutDtos.TransactionView get(@PathVariable long id, Authentication authentication) {
    CheckoutDtos.TransactionView transaction = reader.get(id);
    branches.requireAccess(authentication, transaction.branchId());
    return transaction;
  }

  /** Voiding reverses money and course balances, so it stays with the admins. */
  @PostMapping("/transactions/{id}/void")
  @PreAuthorize("hasAnyRole('ADMIN','FINANCE')")
  public CheckoutDtos.TransactionView voidTransaction(
      @PathVariable long id,
      @Valid @RequestBody CheckoutDtos.VoidRequest request,
      Authentication authentication) {
    return checkout.voidTransaction(id, request.reason(), authentication);
  }

  @GetMapping("/patient-courses")
  public Map<String, Object> courses(
      @RequestParam(required = false) Long patientId,
      @RequestParam(required = false) Long branchId,
      Authentication authentication) {
    if (branchId != null) branches.requireAccess(authentication, branchId);
    return reader.courseLedger(patientId, branchId);
  }
}
