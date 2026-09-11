-- Repair courses created before checkout consistently wrote member balances.
-- This is idempotent and does not change any existing usage or commission data.
INSERT INTO shared_course_members (patient_course_id, patient_id, role, status)
SELECT pc.id, pc.patient_id, 'OWNER', 'ACTIVE'
FROM patient_courses pc
WHERE NOT EXISTS (
  SELECT 1 FROM shared_course_members scm
  WHERE scm.patient_course_id = pc.id AND scm.patient_id = pc.patient_id
);

INSERT INTO course_member_balances (patient_course_id, patient_id, allocated_visits, used_visits)
SELECT pc.id,
       pc.patient_id,
       GREATEST(pc.total_visits + pc.bonus_visits + pc.transfer_in_visits - pc.transfer_out_visits,
                pc.visits_used),
       pc.visits_used
FROM patient_courses pc
WHERE NOT EXISTS (
  SELECT 1 FROM course_member_balances cmb
  WHERE cmb.patient_course_id = pc.id AND cmb.patient_id = pc.patient_id
);
