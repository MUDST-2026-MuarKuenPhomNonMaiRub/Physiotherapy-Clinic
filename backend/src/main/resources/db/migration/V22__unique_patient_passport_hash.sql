-- Passport numbers identify a foreign patient and must not be registered twice.
-- The hash keeps the searchable/unique value out of the database in plaintext;
-- the partial index preserves the application's soft-delete behaviour.
CREATE UNIQUE INDEX IF NOT EXISTS uq_patient_passport_hash
    ON patients(passport_hash)
    WHERE passport_hash IS NOT NULL AND deleted_at IS NULL;
