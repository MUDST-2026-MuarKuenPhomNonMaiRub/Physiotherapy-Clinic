-- Latest clinic meeting rules. This V30 migration is deliberately additive:
-- closed/historical courses keep their original financial snapshots, while
-- new sales can use multi-owner splits, full-price credit, bonus-visit pool
-- dilution, company top-up and special immediate commission.

ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS commission_mode VARCHAR(30) NOT NULL DEFAULT 'STANDARD_TIERED',
  ADD COLUMN IF NOT EXISTS special_commission_type VARCHAR(20),
  ADD COLUMN IF NOT EXISTS special_commission_value NUMERIC(14,4);

ALTER TABLE courses
  ADD CONSTRAINT courses_commission_mode_ck
    CHECK (commission_mode IN ('STANDARD_TIERED','SPECIAL_IMMEDIATE')),
  ADD CONSTRAINT courses_special_commission_ck
    CHECK (
      (commission_mode = 'STANDARD_TIERED'
        AND special_commission_type IS NULL AND special_commission_value IS NULL)
      OR
      (commission_mode = 'SPECIAL_IMMEDIATE'
        AND special_commission_type IN ('FIXED','PERCENTAGE')
        AND special_commission_value IS NOT NULL AND special_commission_value >= 0)
    );

ALTER TABLE patient_courses
  ADD COLUMN IF NOT EXISTS commission_mode VARCHAR(30) NOT NULL DEFAULT 'STANDARD_TIERED',
  ADD COLUMN IF NOT EXISTS clinic_discount_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS special_commission_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS overflow_policy_snapshot VARCHAR(40);

ALTER TABLE patient_courses
  ADD CONSTRAINT patient_courses_commission_mode_ck
    CHECK (commission_mode IN ('STANDARD_TIERED','SPECIAL_IMMEDIATE')),
  ADD CONSTRAINT patient_courses_discount_nonnegative_ck
    CHECK (clinic_discount_amount >= 0),
  ADD CONSTRAINT patient_courses_special_total_nonnegative_ck
    CHECK (special_commission_total >= 0),
  ADD CONSTRAINT patient_courses_overflow_snapshot_ck
    CHECK (overflow_policy_snapshot IS NULL OR overflow_policy_snapshot IN
      ('CAP_AT_COMMISSION','COMPANY_TOP_UP','BLOCK_AND_REQUIRE_APPROVAL'));

CREATE TABLE course_commission_splits (
  id BIGSERIAL PRIMARY KEY,
  patient_course_id BIGINT NOT NULL REFERENCES patient_courses(id),
  employee_id BIGINT NOT NULL REFERENCES staff(id),
  employee_name_snapshot VARCHAR(250) NOT NULL,
  split_order INTEGER NOT NULL,
  sales_credit_amount NUMERIC(14,2) NOT NULL CHECK (sales_credit_amount > 0),
  allocated_visits INTEGER NOT NULL CHECK (allocated_visits > 0),
  used_visits INTEGER NOT NULL DEFAULT 0 CHECK (used_visits >= 0),
  refunded_visits INTEGER NOT NULL DEFAULT 0 CHECK (refunded_visits >= 0),
  commission_status VARCHAR(30) NOT NULL DEFAULT 'PROVISIONAL'
    CHECK (commission_status IN ('PROVISIONAL','LOCKED','PAID_IMMEDIATE','CANCELLED')),
  commission_scheme_id BIGINT REFERENCES commission_schemes(id),
  commission_scheme_version INTEGER,
  monthly_closing_id BIGINT REFERENCES monthly_commission_closings(id),
  locked_commission_rate NUMERIC(7,4),
  total_commission_pool NUMERIC(14,2),
  commission_allocation_per_visit NUMERIC(14,2),
  gross_commission_allocated_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  owner_net_commission_released_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  substitute_treatment_fee_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  immediate_commission_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (patient_course_id, employee_id),
  UNIQUE (patient_course_id, split_order),
  CHECK (used_visits + refunded_visits <= allocated_visits)
);

CREATE INDEX idx_course_commission_splits_employee_status
  ON course_commission_splits(employee_id, commission_status, patient_course_id);
CREATE INDEX idx_course_commission_splits_closing
  ON course_commission_splits(monthly_closing_id);

ALTER TABLE course_usages
  ADD COLUMN IF NOT EXISTS course_commission_split_id BIGINT REFERENCES course_commission_splits(id);
ALTER TABLE commission_allocations
  ADD COLUMN IF NOT EXISTS course_commission_split_id BIGINT REFERENCES course_commission_splits(id);
