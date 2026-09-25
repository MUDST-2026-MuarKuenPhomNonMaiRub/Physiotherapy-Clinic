package com.physiocare.clinic.googlecalendar.listener;

import com.physiocare.clinic.googlecalendar.service.GoogleCalendarSyncService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Picks up appointments whose sync failed or never ran (for example after a restart). */
@Component
public class GoogleCalendarRetryJob {
  private static final Logger log = LoggerFactory.getLogger(GoogleCalendarRetryJob.class);

  private final GoogleCalendarSyncService sync;

  public GoogleCalendarRetryJob(GoogleCalendarSyncService sync) {
    this.sync = sync;
  }

  @Scheduled(
      initialDelayString = "${app.google-calendar.retry-initial-delay-ms:60000}",
      fixedDelayString = "${app.google-calendar.retry-interval-ms:300000}")
  public void retryDue() {
    try {
      sync.retryDue();
    } catch (RuntimeException e) {
      log.error("Google Calendar retry pass failed", e);
    }
  }
}
