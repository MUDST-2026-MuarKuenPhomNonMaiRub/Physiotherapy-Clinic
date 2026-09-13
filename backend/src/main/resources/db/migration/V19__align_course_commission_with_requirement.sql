-- The Commission Requirement mandates release by actual visit usage.
-- ALL_AT_SALE was an exploratory option and is intentionally removed.
ALTER TABLE patient_courses DROP CONSTRAINT IF EXISTS patient_course_payout_mode_ck;
ALTER TABLE commission_schemes DROP CONSTRAINT IF EXISTS commission_scheme_course_payout_mode_ck;
ALTER TABLE patient_courses DROP COLUMN IF EXISTS course_payout_mode;
ALTER TABLE commission_schemes DROP COLUMN IF EXISTS course_payout_mode;
