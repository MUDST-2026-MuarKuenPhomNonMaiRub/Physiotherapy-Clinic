ALTER TABLE commission_schemes
  ADD CONSTRAINT commission_scheme_overflow_policy_ck
    CHECK (overflow_policy IN ('CAP_AT_COMMISSION','COMPANY_TOP_UP','BLOCK_AND_REQUIRE_APPROVAL'));

ALTER TABLE commission_schemes
  ADD CONSTRAINT commission_scheme_termination_policy_ck
    CHECK (after_termination_policy IN ('FORFEIT_AFTER_TERMINATION','CONTINUE_UNTIL_COURSE_END'));

-- A transfer may cross branches. Preserve both sides for reporting and audit.
ALTER TABLE course_transfers
  ADD COLUMN IF NOT EXISTS from_branch_id BIGINT REFERENCES branches(id),
  ADD COLUMN IF NOT EXISTS to_branch_id BIGINT REFERENCES branches(id);

UPDATE course_transfers t
SET from_branch_id = pc.branch_id,
    to_branch_id = pc.branch_id
FROM patient_courses pc
WHERE pc.id = t.patient_course_id
  AND (t.from_branch_id IS NULL OR t.to_branch_id IS NULL);
