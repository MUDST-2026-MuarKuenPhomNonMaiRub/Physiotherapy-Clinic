-- An appointment dragged to another physiotherapist moves its Google event
-- between two people's calendars. The outbox row in appointment_calendar_events
-- follows the appointment to the new therapist; this queue removes the copy
-- left in the old therapist's calendar, with the same retry and back-off, so a
-- Google outage at that moment never leaves a stale event behind.
CREATE TABLE calendar_event_removals (
    appointment_id BIGINT NOT NULL REFERENCES appointments(id),
    staff_id BIGINT NOT NULL REFERENCES staff(id),
    attempts INTEGER NOT NULL DEFAULT 0,
    next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (appointment_id, staff_id)
);
CREATE INDEX idx_calendar_event_removals_due ON calendar_event_removals(next_attempt_at);
