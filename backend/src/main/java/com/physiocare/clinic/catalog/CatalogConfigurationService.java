package com.physiocare.clinic.catalog;

import com.physiocare.clinic.common.InputRules;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import static com.physiocare.clinic.catalog.CatalogConfigurationController.*;

@Service
public class CatalogConfigurationService {
  private final JdbcTemplate db;
  private static final List<String> ICONS = List.of("Banknote", "Landmark", "CreditCard", "Wallet", "Smartphone", "QrCode");
  private static final String PAYMENT_COLUMNS = "id,code,name,icon,requires_reference,requires_attachment,active,deleted_at";

  public CatalogConfigurationService(JdbcTemplate db) { this.db = db; }

  private void validatePayment(PaymentRequest request) {
    InputRules.require(request.name() != null && !request.name().isBlank(), "Payment method name is required");
    InputRules.text(request.name(), 120, "Payment method name");
    InputRules.oneOf(request.icon(), ICONS, "Icon");
  }

  private void checkPaymentName(String name, long exceptId) {
    // Serialize create/rename so concurrent settings writes cannot create duplicate names.
    db.execute("SELECT pg_advisory_xact_lock(68423712)");
    InputRules.require(!Boolean.TRUE.equals(db.queryForObject(
        "SELECT EXISTS(SELECT 1 FROM payment_methods WHERE lower(btrim(name))=lower(?) AND id<>? AND code<>'QR' AND deleted_at IS NULL)",
        Boolean.class, name.trim(), exceptId)), "A payment method with this name already exists");
  }

  @Transactional
  public Map<String, Object> createPayment(PaymentRequest request) {
    validatePayment(request);
    checkPaymentName(request.name(), -1);
    // Immutable generated codes never accidentally acquire the CASH-specific money handling.
    return db.queryForMap("INSERT INTO payment_methods(code,name,icon,active,sort_order) "
        + "VALUES(?,?,?,?,(SELECT COALESCE(max(sort_order),0)+1 FROM payment_methods)) RETURNING " + PAYMENT_COLUMNS,
        "PM_" + UUID.randomUUID().toString().replace("-", ""), request.name().trim(), request.icon(), request.enabled());
  }

  @Transactional
  public Map<String, Object> updatePayment(long id, PaymentRequest request) {
    validatePayment(request);
    checkPaymentName(request.name(), id);
    int changed = db.update("UPDATE payment_methods SET name=?,icon=?,active=? WHERE id=? AND code<>'QR' AND deleted_at IS NULL",
        request.name().trim(), request.icon(), request.enabled(), id);
    InputRules.require(changed == 1, "Payment method not found");
    return db.queryForMap("SELECT " + PAYMENT_COLUMNS + " FROM payment_methods WHERE id=?", id);
  }

  public List<Map<String, Object>> categories() {
    return db.queryForList("SELECT code,name,description,built_in FROM master_data_categories WHERE deleted_at IS NULL ORDER BY sort_order,code");
  }

  private void validateCategory(CategoryRequest request) {
    InputRules.require(request.name() != null && !request.name().isBlank(), "Category name is required");
    InputRules.text(request.name(), 120, "Category name");
    InputRules.text(request.description(), 300, "Description");
  }

  @Transactional
  public Map<String, Object> createCategory(CategoryRequest request) {
    validateCategory(request);
    return db.queryForMap("INSERT INTO master_data_categories(code,name,description,sort_order) "
        + "VALUES(?,?,?,(SELECT COALESCE(max(sort_order),0)+1 FROM master_data_categories)) RETURNING code,name,description,built_in",
        "CUSTOM_" + UUID.randomUUID().toString().replace("-", "").toUpperCase(java.util.Locale.ROOT), request.name().trim(),
        request.description() == null ? "" : request.description().trim());
  }

  @Transactional
  public Map<String, Object> updateCategory(String code, CategoryRequest request) {
    validateCategory(request);
    int changed = db.update("UPDATE master_data_categories SET name=?,description=? WHERE code=? AND deleted_at IS NULL",
        request.name().trim(), request.description() == null ? "" : request.description().trim(), code);
    InputRules.require(changed == 1, "Category not found");
    return db.queryForMap("SELECT code,name,description,built_in FROM master_data_categories WHERE code=?", code);
  }

  @Transactional
  public void deletePayment(long id) {
    InputRules.require(db.update("UPDATE payment_methods SET deleted_at=now(),active=FALSE WHERE id=? AND code<>'QR' AND deleted_at IS NULL", id) == 1,
        "Payment method not found");
  }

  @Transactional
  public void deleteValue(long id) {
    InputRules.require(db.update("UPDATE master_data_values SET deleted_at=now(),active=FALSE WHERE id=? AND deleted_at IS NULL", id) == 1,
        "Master data value not found");
  }

  @Transactional
  public void deleteCategory(String code) {
    InputRules.require(db.update("UPDATE master_data_categories SET deleted_at=now() WHERE code=? AND NOT built_in AND deleted_at IS NULL", code) == 1,
        "Category not found or is a built-in category used by patient forms");
    db.update("UPDATE master_data_values SET deleted_at=now(),active=FALSE WHERE data_type=? AND deleted_at IS NULL", code);
  }
}
