-- Idempotency ledger for the approved legacy transfer repair. Source and duplicate rows remain.
CREATE TABLE legacy_transfer_reconciliations (
  transfer_id BIGINT PRIMARY KEY REFERENCES course_transfers(id),
  source_course_id BIGINT NOT NULL REFERENCES patient_courses(id),
  duplicate_course_id BIGINT NOT NULL REFERENCES patient_courses(id),
  reconciled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(source_course_id, duplicate_course_id)
);
