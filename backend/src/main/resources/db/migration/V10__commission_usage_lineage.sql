-- Canonical lineage between a completed usage (a checkout course-usage or a
-- completed appointment visit) and the commission it earns. This only adds
-- the join table and the columns the allocation pipeline needs; no existing
-- row in patient_courses, commission_allocations, course_ledger_entries,
-- visits or appointments is touched here. Historical backfill happens in
-- V12, after V11 adds the adjustments table these columns reference.

-- One usage = one debit against a patient_course balance, whatever created
-- it (checkout, or later an appointment). It is the association the
-- commission pipeline reads instead of overloading visits.course_id (which
-- has never been populated and is ambiguous about what it would even point
-- to), or reusing commission_allocations directly (that stays 1:1 with a
-- usage but does not exist until the rate is known).
CREATE TABLE course_usages (
    id BIGSERIAL PRIMARY KEY,
    patient_course_id BIGINT NOT NULL REFERENCES patient_courses(id),
    patient_id BIGINT NOT NULL REFERENCES patients(id),
    visit_id BIGINT REFERENCES visits(id),
    sales_transaction_id BIGINT REFERENCES sales_transactions(id),
    course_ledger_entry_id BIGINT REFERENCES course_ledger_entries(id),
    treating_employee_id BIGINT REFERENCES staff(id),
    case_owner_employee_id BIGINT REFERENCES staff(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    usage_date DATE NOT NULL,
    -- PENDING_RATE: course still PROVISIONAL, waiting for monthly close to
    --   freeze a rate before an allocation can be computed.
    -- ALLOCATED: a commission_allocations row exists for this usage.
    -- REVERSED: void/refund undid this usage; the row stays for history.
    -- LEGACY_UNALLOCATED: backfilled from pre-cutover ledger history; never
    --   produced by application code, never gets an allocation.
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING_RATE'
        CHECK (status IN ('PENDING_RATE', 'ALLOCATED', 'REVERSED', 'LEGACY_UNALLOCATED')),
    -- Legacy rows may predate reliable staff attribution; only rows that can
    -- still be allocated are required to name who treated and who owns it.
    idempotency_key VARCHAR(150),
    branch_id BIGINT REFERENCES branches(id),
    created_by BIGINT REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    reversed_at TIMESTAMPTZ,
    reversed_by BIGINT REFERENCES users(id),
    reversal_reason TEXT,
    CHECK (status = 'LEGACY_UNALLOCATED' OR (treating_employee_id IS NOT NULL AND case_owner_employee_id IS NOT NULL))
);

-- An appointment-driven visit may only ever back one usage (unless that
-- usage was reversed, freeing it up for a corrected re-entry).
CREATE UNIQUE INDEX uq_course_usages_visit ON course_usages(visit_id) WHERE visit_id IS NOT NULL AND status <> 'REVERSED';
CREATE UNIQUE INDEX uq_course_usages_idempotency ON course_usages(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX idx_course_usages_course_status ON course_usages(patient_course_id, status);
CREATE INDEX idx_course_usages_ledger_entry ON course_usages(course_ledger_entry_id);

-- Allocation now anchors on one usage instead of one visit, so both a
-- multi-session usage (visit_qty > 1) and a checkout usage with no
-- appointment/visit behind it fit through the same row.
ALTER TABLE commission_allocations ADD COLUMN IF NOT EXISTS course_usage_id BIGINT REFERENCES course_usages(id);
ALTER TABLE commission_allocations ADD COLUMN IF NOT EXISTS visit_qty INTEGER NOT NULL DEFAULT 1 CHECK (visit_qty > 0);
ALTER TABLE commission_allocations ADD COLUMN IF NOT EXISTS allocation_status VARCHAR(20) NOT NULL DEFAULT 'ALLOCATED'
    CHECK (allocation_status IN ('ALLOCATED', 'REVERSED'));
ALTER TABLE commission_allocations ADD COLUMN IF NOT EXISTS reversal_of_id BIGINT REFERENCES commission_allocations(id);
-- visit_id stays for reference (and for the legacy unique(visit_id, patient_course_id)
-- constraint, left in place since it is still correct for every row that has
-- one) but a checkout-only usage has none, so it can no longer be NOT NULL.
ALTER TABLE commission_allocations ALTER COLUMN visit_id DROP NOT NULL;
CREATE UNIQUE INDEX uq_commission_allocations_usage ON commission_allocations(course_usage_id) WHERE course_usage_id IS NOT NULL;

-- Snapshots the pool math needs once a course can be shared, refunded, or
-- diluted by bonus visits without moving the frozen per-visit figure:
--   net_course_sale_amount        the post-discount amount the tier and pool
--                                  are computed from (not the list price)
--   commissionable_visit_count    the paid-visit denominator frozen at close,
--                                  independent of bonus/transfer visits added
--                                  or spent later
--   monthly_closing_id            hard pointer to the closing row that froze
--                                  this course's rate, for audit and override
ALTER TABLE patient_courses ADD COLUMN IF NOT EXISTS case_owner_name_snapshot VARCHAR(250);
ALTER TABLE patient_courses ADD COLUMN IF NOT EXISTS net_course_sale_amount NUMERIC(14,2);
ALTER TABLE patient_courses ADD COLUMN IF NOT EXISTS commissionable_visit_count INTEGER;
ALTER TABLE patient_courses ADD COLUMN IF NOT EXISTS monthly_closing_id BIGINT REFERENCES monthly_commission_closings(id);
