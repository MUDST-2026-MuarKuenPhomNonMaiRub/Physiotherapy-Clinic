package com.physiocare.clinic;

import com.physiocare.clinic.service.BranchService;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.physiocare.clinic.controller.AppointmentController;
import com.physiocare.clinic.controller.AuthController;
import com.physiocare.clinic.controller.CommissionClosingController;
import com.physiocare.clinic.controller.CommissionCourseActionsController;
import com.physiocare.clinic.controller.CatalogController;
import com.physiocare.clinic.controller.CatalogConfigurationController;
import com.physiocare.clinic.controller.GoogleCalendarController;
import com.physiocare.clinic.controller.PatientController;
import com.physiocare.clinic.service.RoomService;
import java.lang.reflect.Method;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.prepost.PreAuthorize;

class SecurityAnnotationsTest {
  private static String policy(Class<?> type, String method) throws Exception {
    Method found = java.util.Arrays.stream(type.getDeclaredMethods())
        .filter(m -> m.getName().equals(method)).findFirst().orElseThrow();
    return found.getAnnotation(PreAuthorize.class).value();
  }

  @Test void patientEndpointsUseLeastPrivilegePermissions() throws Exception {
    assertEquals("@permissionGuard.hasAny(authentication, 'patient.create')", policy(PatientController.class, "create"));
    assertEquals("@permissionGuard.hasAny(authentication, 'patient.edit')", policy(PatientController.class, "update"));
    assertEquals("@permissionGuard.hasAny(authentication, 'patient.view')", policy(PatientController.class, "list"));
    assertEquals("@permissionGuard.hasAny(authentication, 'patient.view')", policy(PatientController.class, "get"));
  }

  @Test void appointmentEndpointsUseLeastPrivilegePermissions() throws Exception {
    assertEquals("@permissionGuard.hasAny(authentication, 'appointment.create')", policy(AppointmentController.class, "create"));
    assertEquals("@permissionGuard.hasAny(authentication, 'appointment.create')", policy(AppointmentController.class, "reschedule"));
    assertEquals("@permissionGuard.hasAny(authentication, 'appointment.view')", policy(AppointmentController.class, "list"));
    assertEquals("@permissionGuard.hasAny(authentication, 'appointment.view')", policy(AppointmentController.class, "get"));
    assertTrue(policy(AppointmentController.class, "transition").contains("appointment.cancel"));
  }

  @Test void delegatedSettingsServicesDoNotOverrideControllerSettingsPermission() throws Exception {
    assertEquals("@permissionGuard.hasAny(authentication, 'settings.manage')", policy(BranchService.class, "create"));
    assertEquals("@permissionGuard.hasAny(authentication, 'settings.manage')", policy(RoomService.class, "create"));
  }

  @Test void accountCreationIsAnAdministrationAction() throws Exception {
    // Every signed-in user could once call this and mint an ADMIN login.
    assertEquals("@permissionGuard.hasAny(authentication, 'settings.manage')", policy(AuthController.class, "createUser"));
  }

  @Test void commissionWritesDoNotHideBehindViewPermissions() throws Exception {
    assertEquals("@permissionGuard.hasAny(authentication, 'commission.close')", policy(CommissionClosingController.class, "close"));
    assertEquals("@permissionGuard.hasAny(authentication, 'commission.adjust')", policy(CommissionCourseActionsController.class, "refundRemaining"));
    assertEquals("@permissionGuard.hasAny(authentication, 'course.share')", policy(CommissionCourseActionsController.class, "addMember"));
    assertEquals("@permissionGuard.hasAny(authentication, 'course.share')", policy(CommissionCourseActionsController.class, "removeMember"));
  }

  @Test void catalogWritesUseTheConfigurableSettingsPermission() throws Exception {
    assertEquals("@permissionGuard.hasAny(authentication, 'settings.manage')", policy(CatalogController.class, "addService"));
    assertEquals("@permissionGuard.hasAny(authentication, 'settings.manage')", policy(CatalogController.class, "addCourse"));
    for (String method : new String[] {"createPayment", "updatePayment", "deletePayment", "createCategory", "updateCategory", "deleteCategory", "deleteValue"}) {
      assertEquals("@permissionGuard.hasAny(authentication, 'settings.manage')", policy(CatalogConfigurationController.class, method));
    }
  }

  @Test void googleCalendarEndpointsUseTheirPermissions() throws Exception {
    assertEquals("@permissionGuard.hasAny(authentication, 'settings.manage')", policy(GoogleCalendarController.class, "connections"));
    assertEquals("@permissionGuard.hasAny(authentication, 'appointment.view')", policy(GoogleCalendarController.class, "appointmentSync"));
    assertEquals("@permissionGuard.hasAny(authentication, 'appointment.edit')", policy(GoogleCalendarController.class, "retry"));
    assertEquals("isAuthenticated()", policy(GoogleCalendarController.class, "connect"));
  }
}
