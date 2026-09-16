CREATE TABLE login_rate_limits (
  email VARCHAR(255) PRIMARY KEY,
  failure_count INTEGER NOT NULL DEFAULT 0 CHECK (failure_count >= 0),
  blocked_until TIMESTAMPTZ,
  last_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_login_rate_limits_last_attempt ON login_rate_limits(last_attempt_at);
