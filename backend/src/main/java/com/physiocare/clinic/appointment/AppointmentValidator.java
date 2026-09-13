package com.physiocare.clinic.appointment;

import com.physiocare.clinic.common.InputRules;
import java.time.Duration;
import java.time.OffsetDateTime;
import org.springframework.stereotype.Component;

@Component
public class AppointmentValidator {
  public void validateSlot(OffsetDateTime startsAt, OffsetDateTime endsAt) {
    InputRules.require(endsAt.isAfter(startsAt), "The end time must be after the start time");
    long minutes = Duration.between(startsAt, endsAt).toMinutes();
    InputRules.require(minutes <= InputRules.MAX_DURATION_MINUTES,
        "An appointment cannot run longer than " + (InputRules.MAX_DURATION_MINUTES / 60) + " hours");
    InputRules.bookingWindow(startsAt);
  }

  public void validateNotes(String patientNote, String internalNote) {
    InputRules.text(patientNote, 500, "The note");
    InputRules.text(internalNote, 500, "The internal note");
  }
}
