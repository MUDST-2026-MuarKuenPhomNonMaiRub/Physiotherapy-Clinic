-- Self-service password reset by email. Only a SHA-256 hash of each token is
-- stored, so a leaked table cannot be used to reset anyone's password.
CREATE TABLE password_reset_tokens (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash CHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_password_reset_tokens_user_created ON password_reset_tokens(user_id, created_at DESC);

-- Sessions issued before this moment are no longer accepted, so changing a
-- password also signs the account out everywhere else.
ALTER TABLE users ADD COLUMN password_changed_at TIMESTAMPTZ;
