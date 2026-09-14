-- Protect booking correctness at the database boundary. Application-side
-- availability checks are still useful for a friendly error, but cannot by
-- themselves prevent two concurrent requests from booking one room.
ALTER TABLE appointments
  ADD CONSTRAINT appointments_no_room_overlap
  EXCLUDE USING gist (
    room_id WITH =,
    tstzrange(starts_at, ends_at, '[)') WITH &&
  )
  WHERE (room_id IS NOT NULL AND status IN ('CONFIRMED','ARRIVED','IN_SERVICE'));

-- Human-readable numbers must not depend on row counts.
CREATE SEQUENCE appointment_no_seq;
CREATE SEQUENCE sales_transaction_no_seq;
CREATE SEQUENCE payment_no_seq;
CREATE SEQUENCE course_transfer_no_seq;
CREATE SEQUENCE patient_course_no_seq;

-- These columns were introduced as a compatibility surface, but raw identity
-- numbers must not remain in the database. The hash columns remain available
-- for duplicate detection. A future encrypted-display flow can use the
-- existing *_ciphertext columns with a key held outside PostgreSQL.
UPDATE patients SET national_id = NULL, passport_no = NULL
WHERE national_id IS NOT NULL OR passport_no IS NOT NULL;
