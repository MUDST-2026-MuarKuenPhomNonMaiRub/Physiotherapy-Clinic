package com.physiocare.clinic.sales;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

/** HTTP adapter for sales and payment operations. */
@RestController
@RequestMapping("/api/v1/sales")
public class SalesController {
  private final SalesService service;
  public SalesController(SalesService service) { this.service = service; }

  public record SaleRequest(@Positive long patientId, @Positive long branchId,
      @Positive long packageId, @Positive long sellerEmployeeId,
      @Positive long caseOwnerEmployeeId, @NotNull @DecimalMin("0") BigDecimal amount,
      @Positive int visits) {}
  public record PaymentRequest(@Positive long salesTransactionId, @Positive long paymentMethodId,
      @NotNull @DecimalMin("0.01") BigDecimal amount, String referenceNo) {}

  @PostMapping("/courses") @ResponseStatus(HttpStatus.CREATED)
  public Object createCourseSale(@Valid @RequestBody SaleRequest r, Authentication authentication) {
    return service.createCourseSale(new SalesService.SaleRequest(r.patientId(), r.branchId(), r.packageId(),
        r.sellerEmployeeId(), r.caseOwnerEmployeeId(), r.amount(), r.visits()), authentication);
  }
  @PostMapping("/payments") @ResponseStatus(HttpStatus.CREATED)
  public Object pay(@Valid @RequestBody PaymentRequest r) {
    return service.pay(new SalesService.PaymentRequest(r.salesTransactionId(), r.paymentMethodId(), r.amount(), r.referenceNo()));
  }
  @PostMapping("/{id}/cancel")
  public Object cancel(@PathVariable long id, @RequestParam String reason) { return service.cancel(id, reason); }
}
