package com.physiocare.clinic.service;

import static org.junit.jupiter.api.Assertions.*;
import static com.physiocare.clinic.dto.catalog.CatalogConfigurationDtos.*;
import static com.physiocare.clinic.dto.catalog.CatalogDtos.*;

import com.physiocare.clinic.dto.checkout.CheckoutDtos.CheckoutRequest;
import com.physiocare.clinic.controller.CatalogConfigurationController;
import com.physiocare.clinic.repository.CheckoutRepository;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.test.context.support.WithMockUser;

/** Run explicitly against a disposable PostgreSQL DB with -Dtest=CatalogConfigurationIT. */
@WithMockUser(roles = "ADMIN")
class CatalogConfigurationIT extends AbstractCommissionIntegrationTest {
  @Autowired CatalogConfigurationService configuration;
  @Autowired CatalogService catalog;
  @Autowired CheckoutRepository repository;
  @Autowired CheckoutService checkout;
  @Autowired CatalogConfigurationController controller;

  @Test void customPaymentCanSettleRealCheckoutAndDeletionPreservesHistory() {
    var method = configuration.createPayment(new PaymentRequest("Test Wallet", "Wallet", true));
    long methodId = ((Number) method.get("id")).longValue();
    long actor = seedActorUserId();
    long patient = seedPatient("Catalog Test");
    long service = db.queryForObject("SELECT id FROM services WHERE service_type='ASSESSMENT' LIMIT 1", Long.class);
    var authentication = new UsernamePasswordAuthenticationToken("actor" + actor + "@test.local", "",
        List.of(new SimpleGrantedAuthority("ROLE_ADMIN")));
    var sale = checkout.checkout(new CheckoutRequest(patient, 1, null, service, null, null, null, false,
        null, null, methodId, null, null, null, null, List.of()), authentication);
    assertEquals(methodId, sale.paymentMethodId());
    assertEquals("COMPLETED", sale.status());
    assertFalse(repository.isCash(methodId));
    configuration.deletePayment(methodId);
    assertInstanceOf(IllegalArgumentException.class, assertThrows(org.springframework.dao.InvalidDataAccessApiUsageException.class,
        () -> repository.requireActivePaymentMethod(methodId)).getCause());
    assertEquals(methodId, db.queryForObject("SELECT payment_method_id FROM sales_transactions WHERE id=?", Long.class, sale.id()));
    assertTrue(catalog.payments().stream().anyMatch(row -> row.get("id").equals(methodId) && row.get("deleted_at") != null));
    assertThrows(IllegalArgumentException.class, () -> catalog.setPaymentMethodStatus(methodId, new ActiveRequest(true)));
  }

  @Test void disabledMethodIsNotAcceptedAndRenameKeepsCode() {
    var method = configuration.createPayment(new PaymentRequest("Disabled Wallet", "Smartphone", false));
    long id = ((Number) method.get("id")).longValue();
    assertInstanceOf(IllegalArgumentException.class, assertThrows(org.springframework.dao.InvalidDataAccessApiUsageException.class,
        () -> repository.requireActivePaymentMethod(id)).getCause());
    var updated = configuration.updatePayment(id, new PaymentRequest("Renamed Wallet", "CreditCard", true));
    assertEquals(method.get("code"), updated.get("code"));
    assertDoesNotThrow(() -> repository.requireActivePaymentMethod(id));
    long cashId = db.queryForObject("SELECT id FROM payment_methods WHERE code='CASH'", Long.class);
    configuration.updatePayment(cashId, new PaymentRequest("Cash renamed", "Banknote", true));
    assertTrue(repository.isCash(cashId));
  }

  @Test void emptyCategoryPersistsAndRenamingDoesNotLoseValues() {
    var category = configuration.createCategory(new CategoryRequest("Custom membership", "Description"));
    String code = (String) category.get("code");
    assertTrue(configuration.categories().stream().anyMatch(c -> code.equals(c.get("code"))));
    assertTrue(catalog.master(code).isEmpty());
    var value = catalog.addMasterData(new MasterDataRequest(code, "Gold", null, true));
    configuration.updateCategory(code, new CategoryRequest("Membership levels", "Updated"));
    assertEquals(value.get("id"), catalog.master(code).getFirst().get("id"));
    configuration.deleteCategory(code);
    assertTrue(catalog.master(code).isEmpty());
    assertFalse(configuration.categories().stream().anyMatch(c -> code.equals(c.get("code"))));
    assertThrows(IllegalArgumentException.class, () -> catalog.addMasterData(new MasterDataRequest(code, "Silver", null, true)));
  }

  @Test void individualValueCanBeDeletedWithoutRemovingItsCategory() {
    var value = catalog.addMasterData(new MasterDataRequest("CUSTOMER_GROUP", "Temporary group", null, true));
    long id = ((Number) value.get("id")).longValue();
    configuration.deleteValue(id);
    assertFalse(catalog.allMasterData().stream().anyMatch(v -> v.get("id").equals(id)));
    assertTrue(configuration.categories().stream().anyMatch(c -> "CUSTOMER_GROUP".equals(c.get("code"))));
    assertThrows(IllegalArgumentException.class, () -> catalog.setMasterDataStatus(id, new ActiveRequest(true)));
  }

  @Test void builtinCategoriesCannotBeDeleted() {
    assertThrows(IllegalArgumentException.class, () -> configuration.deleteCategory("CUSTOMER_GROUP"));
  }

  @Test void duplicatePaymentNamesAndInvalidIconsAreRejected() {
    configuration.createPayment(new PaymentRequest("Example", "Wallet", true));
    assertThrows(IllegalArgumentException.class, () -> configuration.createPayment(new PaymentRequest(" example ", "Wallet", true)));
    assertThrows(IllegalArgumentException.class, () -> configuration.createPayment(new PaymentRequest("Other", "NotAnIcon", true)));
    assertThrows(IllegalArgumentException.class, () -> configuration.createPayment(new PaymentRequest("   ", "Wallet", true)));
  }

  @Test void duplicateCategoryNameIsRejectedByDatabase() {
    configuration.createCategory(new CategoryRequest("Membership", ""));
    assertThrows(org.springframework.dao.DataIntegrityViolationException.class,
        () -> configuration.createCategory(new CategoryRequest(" membership ", "")));
  }

  @Test @WithMockUser(authorities = "transaction.view")
  void nonAdminCannotCreateOrDeleteCatalogEntries() {
    assertThrows(org.springframework.security.access.AccessDeniedException.class,
        () -> controller.createPayment(new PaymentRequest("Forbidden", "Wallet", true)));
    assertThrows(org.springframework.security.access.AccessDeniedException.class, () -> controller.deletePayment(1));
    assertThrows(org.springframework.security.access.AccessDeniedException.class,
        () -> controller.createCategory(new CategoryRequest("Forbidden", "")));
    assertThrows(org.springframework.security.access.AccessDeniedException.class, () -> controller.deleteValue(1));
  }
}
