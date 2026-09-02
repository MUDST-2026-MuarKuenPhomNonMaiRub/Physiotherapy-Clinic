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

INSERT INTO branches (code, name, phone, address)
VALUES
    ('BKK', 'สาขาสุขุมวิท (Sukhumvit)', '02-105-4421', '123 ถนนสุขุมวิท แขวงคลองตันเหนือ เขตวัฒนา กรุงเทพฯ 10110'),
    ('SAL', 'สาขาศาลายา (Salaya)', '02-441-0987', '99 ถนนศาลายา-นครชัยศรี อ.พุทธมณฑล จ.นครปฐม 73170'),
    ('CNX', 'สาขาเชียงใหม่ (Chiang Mai)', '053-224-556', '45 ถนนนิมมานเหมินท์ ต.สุเทพ อ.เมือง จ.เชียงใหม่ 50200')
ON CONFLICT (code) DO NOTHING;

INSERT INTO course_member_balances (patient_course_id, patient_id, allocated_visits)
SELECT scm.patient_course_id, scm.patient_id, pc.total_visits
FROM shared_course_members scm
JOIN patient_courses pc ON pc.id = scm.patient_course_id
WHERE scm.role = 'OWNER'
ON CONFLICT (patient_course_id, patient_id) DO NOTHING;
