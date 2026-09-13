ALTER TABLE branches ALTER COLUMN code TYPE VARCHAR(20);

CREATE TABLE course_member_balances (
    patient_course_id BIGINT NOT NULL REFERENCES patient_courses(id),
    patient_id BIGINT NOT NULL REFERENCES patients(id),
    allocated_visits INTEGER NOT NULL CHECK (allocated_visits >= 0),
    used_visits INTEGER NOT NULL DEFAULT 0 CHECK (used_visits >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (patient_course_id, patient_id),
    CHECK (used_visits <= allocated_visits)
);

CREATE INDEX idx_course_member_balances_patient
    ON course_member_balances(patient_id, patient_course_id);

-- Existing course/member balance backfill is handled once, comprehensively,
-- in V12 after all commission lineage tables exist.
INSERT INTO branches (code, name, phone, address, active)
VALUES
    ('R9', 'พระราม 9', NULL, 'พระราม 9 กรุงเทพฯ', TRUE),
    ('BR', 'แบริ่ง', NULL, 'ซอยแบริ่ง 4 สมุทรปราการ', TRUE)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    address = EXCLUDED.address,
    active = TRUE,
    deleted_at = NULL;
