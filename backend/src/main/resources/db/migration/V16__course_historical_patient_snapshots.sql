ALTER TABLE patient_courses ADD COLUMN IF NOT EXISTS patient_hn_snapshot VARCHAR(20);
ALTER TABLE patient_courses ADD COLUMN IF NOT EXISTS patient_name_snapshot VARCHAR(250);

UPDATE patient_courses pc
SET patient_hn_snapshot = p.hn,
    patient_name_snapshot = trim(concat_ws(' ', p.prefix, p.first_name_th, p.last_name_th))
FROM patients p
WHERE p.id = pc.patient_id
  AND (pc.patient_hn_snapshot IS NULL OR pc.patient_name_snapshot IS NULL);
