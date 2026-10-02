-- The header bell. Notifications are worked out from the clinic's own records
-- each time they are read (see NotificationService), so the only thing stored
-- is which of them each person has already seen — kept on the server so it
-- follows them from the front-desk PC to their phone.
CREATE TABLE notification_reads (
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    notification_key VARCHAR(120) NOT NULL,
    read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, notification_key)
);
CREATE INDEX idx_notification_reads_read_at ON notification_reads(read_at);

-- Recent changes to a therapist's bookings are read by time, every poll.
CREATE INDEX idx_appointment_events_occurred_at ON appointment_events(occurred_at DESC);
-- Today's voids, for the manager's bell.
CREATE INDEX idx_transaction_cancellations_cancelled_at ON transaction_cancellations(cancelled_at DESC);
