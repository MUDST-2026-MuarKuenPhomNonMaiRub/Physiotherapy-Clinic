-- Transferred course targets created before the transfer flow maintained
-- course_member_balances can be missing their recipient balance row. Repair
-- only those target-owner rows; the operation is safe to run once by Flyway
-- and remains harmless if a row already exists.
INSERT INTO shared_course_members (patient_course_id, patient_id, role, status)
SELECT pc.id, pc.patient_id, 'OWNER', 'ACTIVE'
FROM patient_courses pc
JOIN course_transfers ct ON ct.to_patient_course_id = pc.id
ON CONFLICT (patient_course_id, patient_id) DO NOTHING;

INSERT INTO course_member_balances (patient_course_id, patient_id, allocated_visits, used_visits)
SELECT pc.id,
       pc.patient_id,
       GREATEST(pc.total_visits + pc.bonus_visits + pc.transfer_in_visits - pc.transfer_out_visits,
                pc.visits_used),
       pc.visits_used
FROM patient_courses pc
JOIN course_transfers ct ON ct.to_patient_course_id = pc.id
WHERE NOT EXISTS (
  SELECT 1
  FROM course_member_balances cmb
  WHERE cmb.patient_course_id = pc.id
    AND cmb.patient_id = pc.patient_id
);
