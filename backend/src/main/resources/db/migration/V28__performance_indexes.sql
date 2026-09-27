-- Query-performance indexes for the operational lists and reports.
-- Keep this migration additive: shipped migrations remain immutable.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Branch-scoped operational lists and soft-deleted records.
CREATE INDEX IF NOT EXISTS idx_patients_branch_active
  ON patients (registered_branch_id, id DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_patient_courses_branch_status
  ON patient_courses (branch_id, status, id DESC);
CREATE INDEX IF NOT EXISTS idx_patient_courses_patient
  ON patient_courses (patient_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_course_members_patient
  ON course_member_balances (patient_id, patient_course_id);

-- Appointment calendar and patient history.
CREATE INDEX IF NOT EXISTS idx_appointments_patient_time
  ON appointments (patient_id, starts_at DESC);
CREATE INDEX IF NOT EXISTS idx_appointments_provider_time
  ON appointments (provider_staff_id, starts_at DESC);
CREATE INDEX IF NOT EXISTS idx_appointments_branch_status_time
  ON appointments (branch_id, status, starts_at DESC);
CREATE INDEX IF NOT EXISTS idx_visits_patient_date
  ON visits (patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_visits_branch_date
  ON visits (branch_id, created_at DESC);

-- Checkout and transaction history.
CREATE INDEX IF NOT EXISTS idx_transactions_patient_date
  ON sales_transactions (patient_id, sold_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_branch_status_date
  ON sales_transactions (branch_id, status, sold_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_sales_items_transaction
  ON sales_items (sales_transaction_id, id);
CREATE INDEX IF NOT EXISTS idx_payments_transaction
  ON payments (sales_transaction_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_transaction_commissions_transaction
  ON transaction_commissions (sales_transaction_id, id);
CREATE INDEX IF NOT EXISTS idx_ledger_related_transaction
  ON course_ledger_entries (related_transaction_id, id);

-- Course commission and audit reports.
CREATE INDEX IF NOT EXISTS idx_allocations_course_date
  ON commission_allocations (patient_course_id, visit_date DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_allocations_owner_date
  ON commission_allocations (case_owner_employee_id, visit_date DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_allocations_treating_date
  ON commission_allocations (treating_employee_id, visit_date DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_audit_branch_time
  ON audit_logs (branch_id, occurred_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action_time
  ON audit_logs (action, occurred_at DESC, id DESC);

-- Trigram indexes make the existing contains-searches usable at scale.
CREATE INDEX IF NOT EXISTS idx_patients_hn_trgm
  ON patients USING gin (hn gin_trgm_ops) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_patients_names_trgm
  ON patients USING gin ((first_name_th || ' ' || last_name_th) gin_trgm_ops)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_patients_nickname_trgm
  ON patients USING gin (nickname gin_trgm_ops) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_patients_phone_trgm
  ON patients USING gin (phone gin_trgm_ops) WHERE deleted_at IS NULL;
