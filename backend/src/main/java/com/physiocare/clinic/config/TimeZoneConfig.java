package com.physiocare.clinic.config;

import jakarta.annotation.PostConstruct;
import java.time.ZoneId;
import java.util.TimeZone;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;

/**
 * Pins the JVM to the clinic's local time zone. Every "today" in the code —
 * a receipt's sale date and sale month, a course usage date, an appointment
 * list for a given day, the year in a document number — comes from
 * {@code LocalDate.now()}, which reads the JVM default. The Docker image has
 * no zone configured and so runs on UTC, seven hours behind Bangkok: a course
 * sold at 01:00 on the first of the month would land in the previous month's
 * commission closing. The database side of the same problem ({@code
 * CURRENT_DATE}, {@code ::date} casts) is handled by the connection init SQL
 * in application.properties, which sets the session zone from the same value.
 */
@Configuration
public class TimeZoneConfig {
  @Value("${app.timezone}")
  private String timezone;

  @PostConstruct
  void applyDefaultTimeZone() {
    TimeZone.setDefault(TimeZone.getTimeZone(ZoneId.of(timezone)));
  }
}
