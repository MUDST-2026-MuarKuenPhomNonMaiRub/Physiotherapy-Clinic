package com.physiocare.clinic.googlecalendar.service;

import com.physiocare.clinic.googlecalendar.model.AppointmentSyncSnapshot;
import com.physiocare.clinic.googlecalendar.model.CalendarEvent;
import java.time.ZoneId;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Decides what an appointment looks like in Google Calendar. The event is
 * stored by Google, outside the clinic, so under PDPA it carries only what the
 * physiotherapist needs to recognise the visit: HN, a short name and the
 * treatment. Phone numbers, surnames and notes stay in the clinic system.
 */
@Component
public class CalendarEventFactory {
  private final ZoneId zone;

  public CalendarEventFactory(@Value("${app.timezone:Asia/Bangkok}") String timezone) {
    this.zone = ZoneId.of(timezone);
  }

  public CalendarEvent build(AppointmentSyncSnapshot a) {
    String summary = a.serviceName() + " · " + a.hn() + " " + a.patientShortName();
    StringBuilder description = new StringBuilder()
        .append("เลขนัด: ").append(a.appointmentNo()).append('\n')
        .append("HN: ").append(a.hn()).append('\n')
        .append("คนไข้: ").append(a.patientShortName()).append('\n')
        .append("บริการ: ").append(a.serviceName()).append('\n')
        .append("สาขา: ").append(a.branchName()).append('\n');
    if (a.roomName() != null) description.append("ห้อง: ").append(a.roomName()).append('\n');
    description.append('\n')
        .append("ซิงก์อัตโนมัติจากระบบ PhysioCare — แก้ไขหรือยกเลิกนัดในระบบคลินิกเท่านั้น")
        .append(" การแก้ไขใน Google Calendar จะไม่ถูกบันทึกกลับ");
    String location = a.roomName() == null ? a.branchName() : a.branchName() + " · " + a.roomName();
    return new CalendarEvent(
        summary.trim(),
        description.toString(),
        location,
        a.startsAt().atZoneSameInstant(zone).toOffsetDateTime(),
        a.endsAt().atZoneSameInstant(zone).toOffsetDateTime(),
        zone.getId(),
        a.appointmentId());
  }
}
