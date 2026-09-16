-- One-way push of appointments into each physiotherapist's own Google
-- Calendar. The clinic system stays the source of truth: nothing here is
-- ever read back from Google, and an event edited there is overwritten by
-- the next push.

-- One connection per staff member. The refresh token is the only secret and
-- is stored encrypted with the same key that protects patient identity
-- numbers; the access token it mints is short-lived and kept in memory only.
CREATE TABLE staff_google_calendars (
    staff_id BIGINT PRIMARY KEY REFERENCES staff(id),
    google_email VARCHAR(255),
    calendar_id VARCHAR(255) NOT NULL DEFAULT 'primary',
    refresh_token_ciphertext TEXT NOT NULL,
    connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    connected_by BIGINT REFERENCES users(id),
    last_error TEXT,
    last_error_at TIMESTAMPTZ
);

-- Outbox: one row per appointment that has (or should have) an event in
-- Google. A worker drains PENDING rows; a failure keeps the row with the
-- error and a back-off so a Google outage never blocks the counter.
CREATE TABLE appointment_calendar_events (
    appointment_id BIGINT PRIMARY KEY REFERENCES appointments(id),
    staff_id BIGINT NOT NULL REFERENCES staff(id),
    google_event_id VARCHAR(255),
    pending_action VARCHAR(10) NOT NULL DEFAULT 'UPSERT' CHECK (pending_action IN ('UPSERT', 'DELETE')),
    sync_status VARCHAR(10) NOT NULL DEFAULT 'PENDING' CHECK (sync_status IN ('PENDING', 'SYNCED', 'FAILED', 'DELETED')),
    attempts INTEGER NOT NULL DEFAULT 0,
    next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_error TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_appointment_calendar_events_due
    ON appointment_calendar_events(next_attempt_at) WHERE sync_status IN ('PENDING', 'FAILED');
CREATE INDEX idx_appointment_calendar_events_staff ON appointment_calendar_events(staff_id);

-- The OAuth "state" handed to Google and checked on the way back, so a
-- callback can only ever attach a Google account to the staff member who
-- started the connection.
CREATE TABLE google_oauth_states (
    state VARCHAR(100) PRIMARY KEY,
    staff_id BIGINT NOT NULL REFERENCES staff(id),
    user_id BIGINT NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
