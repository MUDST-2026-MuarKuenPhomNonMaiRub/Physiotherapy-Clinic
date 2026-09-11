package com.physiocare.clinic.common;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.physiocare.clinic.appointment.AppointmentController.AppointmentRequest;
import com.physiocare.clinic.auth.AuthDtos.CreateUserRequest;
import com.physiocare.clinic.catalog.CatalogController.CourseRequest;
import com.physiocare.clinic.catalog.CatalogController.ServiceRequest;
import com.physiocare.clinic.checkout.CheckoutDtos.Adjustment;
import com.physiocare.clinic.checkout.CheckoutDtos.CheckoutRequest;
import com.physiocare.clinic.patient.PatientController.PatientRequest;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.Set;
import java.util.stream.Collectors;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

class RequestValidationTest {
  private static ValidatorFactory factory;
  private static Validator validator;

  @BeforeAll
  static void createValidator() {
    factory = Validation.buildDefaultValidatorFactory();
    validator = factory.getValidator();
  }

  @AfterAll
  static void closeValidator() {
    factory.close();
  }

  @Test
  void createUserRequiresValidEmailAndStrongPassword() {
    CreateUserRequest valid = new CreateUserRequest("staff@example.com", "StrongPass1!", "A", "B", "PHYSIO");
    assertTrue(validator.validate(valid).isEmpty());

    CreateUserRequest invalid = new CreateUserRequest("not-an-email", "weak", "", "", "");
    assertInvalidFields(invalid, "email", "password", "firstName", "lastName", "role");
  }

  @Test
  void patientRequiresIdentityFieldsAndPositiveBranch() {
    PatientRequest invalid = new PatientRequest(
        "", "", "", "", null, null, null, "", null, null, null, null, null,
        "", null, null, null, null, null, 0);
    assertInvalidFields(invalid, "customerType", "prefix", "firstNameTh", "lastNameTh", "genderCode", "phone", "registeredBranchId");
  }

  @Test
  void serviceRequiresNameTypeDurationAndPrice() {
    ServiceRequest invalid = new ServiceRequest(null, "", null, "", 0, null, null);
    assertInvalidFields(invalid, "nameTh", "serviceType", "durationMinutes", "basePrice");

    ServiceRequest valid = new ServiceRequest("SVC-TEST", "Assessment", null, "ASSESSMENT", 30,
        new BigDecimal("500"), true);
    assertTrue(validator.validate(valid).isEmpty());
  }

  @Test
  void courseRequiresNamePositiveSessionsValidityAndPrice() {
    CourseRequest invalid = new CourseRequest(null, "", null, null, 0, -1, 0, null, null);
    assertInvalidFields(invalid, "nameTh", "totalSessions", "bonusSessions", "validityDays", "price");

    CourseRequest valid = new CourseRequest("COURSE-TEST", "Ten visits", null, "Test course", 10, 1,
        180, new BigDecimal("10000"), true);
    assertTrue(validator.validate(valid).isEmpty());
  }

  @Test
  void appointmentRequiresPositiveReferencesAndBothTimes() {
    AppointmentRequest invalid = new AppointmentRequest(0, 0, 0, 0, null, null, null, null, null);
    assertInvalidFields(invalid, "patientId", "branchId", "providerStaffId", "serviceId", "startsAt", "endsAt");

    OffsetDateTime starts = OffsetDateTime.parse("2026-09-12T09:00:00+07:00");
    AppointmentRequest valid = new AppointmentRequest(1, 1, 1, 1, 1L, starts, starts.plusMinutes(30), null, null);
    assertTrue(validator.validate(valid).isEmpty());
  }

  @Test
  void checkoutRequiresPatientBranchPaymentAndValidAdjustment() {
    CheckoutRequest invalid = new CheckoutRequest(0, 0, null, null, null, null, null, false, null, null, 0,
        null, null, null, null, null);
    assertInvalidFields(invalid, "patientId", "branchId", "paymentMethodId");

    CheckoutRequest valid = new CheckoutRequest(1, 1, null, 1L, null, null, null, false, 1L, null, 1,
        null, null, null, null, java.util.List.of(new Adjustment("Discount", new BigDecimal("-50"))));
    assertTrue(validator.validate(valid).isEmpty());
  }

  @Test
  void adjustmentRequiresLabelAndAmount() {
    assertFalse(validator.validate(new Adjustment("", null)).isEmpty());
    assertDoesNotThrow(() -> validator.validate(new Adjustment("Extra charge", new BigDecimal("100"))));
    assertTrue(validator.validate(new Adjustment("Extra charge", new BigDecimal("100"))).isEmpty());
  }

  private static <T> void assertInvalidFields(T value, String... expectedFields) {
    Set<String> fields = validator.validate(value).stream()
        .map(violation -> violation.getPropertyPath().toString())
        .collect(Collectors.toSet());
    for (String expectedField : expectedFields) {
      assertTrue(fields.contains(expectedField), "Expected validation error for " + expectedField + ", got " + fields);
    }
  }
}
