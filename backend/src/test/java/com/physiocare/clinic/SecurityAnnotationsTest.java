package com.physiocare.clinic;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.physiocare.clinic.appointment.AppointmentController;
import com.physiocare.clinic.branch.BranchService;
import com.physiocare.clinic.catalog.CatalogController;
import com.physiocare.clinic.googlecalendar.controller.GoogleCalendarController;
import com.physiocare.clinic.patient.PatientController;
import com.physiocare.clinic.room.RoomService;
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

  @Test void catalogWritesUseTheConfigurableSettingsPermission() throws Exception {
    assertEquals("@permissionGuard.hasAny(authentication, 'settings.manage')", policy(CatalogController.class, "addService"));
    assertEquals("@permissionGuard.hasAny(authentication, 'settings.manage')", policy(CatalogController.class, "addCourse"));
  }

  @Test void googleCalendarAdminAndSyncEndpointsNeedTheirPermissions() throws Exception {
    assertEquals("@permissionGuard.hasAny(authentication, 'settings.manage')", policy(GoogleCalendarController.class, "listConnections"));
    assertEquals("@permissionGuard.hasAny(authentication, 'settings.manage')", policy(GoogleCalendarController.class, "disconnectStaff"));
    assertEquals("@permissionGuard.hasAny(authentication, 'appointment.edit')", policy(GoogleCalendarController.class, "retrySync"));
    assertEquals("isAuthenticated()", policy(GoogleCalendarController.class, "connect"));
  }
}
