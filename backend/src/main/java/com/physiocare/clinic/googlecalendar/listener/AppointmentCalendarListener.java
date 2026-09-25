package com.physiocare.clinic.googlecalendar.listener;

import com.physiocare.clinic.appointment.AppointmentChangedEvent;
import com.physiocare.clinic.googlecalendar.config.GoogleCalendarConfig;
import com.physiocare.clinic.googlecalendar.model.GoogleCalendarConnectedEvent;
import com.physiocare.clinic.googlecalendar.service.GoogleCalendarSyncService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/** Entry point from the appointment module into the Google Calendar sync. */
@Component
public class AppointmentCalendarListener {
  private static final Logger log = LoggerFactory.getLogger(AppointmentCalendarListener.class);

  private final GoogleCalendarSyncService sync;

  public AppointmentCalendarListener(GoogleCalendarSyncService sync) {
    this.sync = sync;
  }

  /**
   * Runs synchronously inside the booking transaction, so the sync state is
   * saved with the booking and already shows in the API reply.
   */
  @EventListener
  public void recordPendingSync(AppointmentChangedEvent event) {
    sync.prepare(event);
  }

  /** Talks to Google only once the booking is committed, off the request thread. */
  @Async(GoogleCalendarConfig.EXECUTOR)
  @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
  public void pushToGoogle(AppointmentChangedEvent event) {
    try {
      sync.sync(event.appointmentId());
    } catch (RuntimeException e) {
      log.error("Google Calendar sync for appointment {} did not run", event.appointmentId(), e);
    }
  }

  @Async(GoogleCalendarConfig.EXECUTOR)
  @EventListener
  public void catchUpAfterConnect(GoogleCalendarConnectedEvent event) {
    try {
      sync.syncUpcomingFor(event.staffId());
    } catch (RuntimeException e) {
      log.error("Could not copy upcoming appointments for staff {}", event.staffId(), e);
    }
  }
}
