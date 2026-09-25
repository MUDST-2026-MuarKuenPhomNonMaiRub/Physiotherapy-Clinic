-- Google Calendar auto-sync. Each physiotherapist links their own Google
-- account; appointments they provide are then copied into that calendar.

-- One linked Google account per staff member. The refresh token is encrypted
-- with the same AES-GCM key as patient identity numbers and is never returned
-- by the API.
CREATE TABLE google_calendar_connections (
  id BIGSERIAL PRIMARY KEY,
  staff_id BIGINT NOT NULL UNIQUE REFERENCES staff(id),
  google_email VARCHAR(255),
  refresh_token_ciphertext TEXT NOT NULL,
  calendar_id VARCHAR(255) NOT NULL DEFAULT 'primary',
  -- ACTIVE, or REAUTH_REQUIRED once Google stops accepting the refresh token
  -- (the person revoked access, or the OAuth app is still in Testing mode).
  status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
  last_error TEXT,
  connected_by BIGINT REFERENCES users(id),
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (status IN ('ACTIVE', 'REAUTH_REQUIRED'))
);

-- Sync state lives on the appointment so the schedule screens can show it.
-- google_sync_status stays NULL while the integration is switched off.
ALTER TABLE appointments ADD COLUMN google_event_id VARCHAR(1024);
ALTER TABLE appointments ADD COLUMN google_sync_status VARCHAR(20);
ALTER TABLE appointments ADD COLUMN google_synced_at TIMESTAMPTZ;
ALTER TABLE appointments ADD COLUMN google_sync_error TEXT;
ALTER TABLE appointments ADD COLUMN google_sync_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE appointments ADD COLUMN google_sync_attempted_at TIMESTAMPTZ;
ALTER TABLE appointments ADD CONSTRAINT appointments_google_sync_status_check
  CHECK (google_sync_status IS NULL OR google_sync_status IN
    ('PENDING', 'SYNCED', 'FAILED', 'SKIPPED', 'REMOVED', 'MOVED'));

-- The retry job only ever looks for rows still waiting or failed.
CREATE INDEX idx_appointments_google_sync_retry ON appointments(google_sync_status, google_sync_attempted_at)
  WHERE google_sync_status IN ('PENDING', 'FAILED');
