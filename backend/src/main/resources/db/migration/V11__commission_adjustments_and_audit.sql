-- Append-only corrections layered on top of the frozen pool: a refund that
-- shrinks outstanding pool, an admin override on an already-closed month, or
-- a manual correction. Nothing in this pipeline ever updates or deletes an
-- existing commission_allocations or monthly_commission_closings row — a
-- correction is always a new row here that nets against it.
CREATE TABLE commission_adjustments (
    id BIGSERIAL PRIMARY KEY,
    patient_course_id BIGINT NOT NULL REFERENCES patient_courses(id),
    commission_allocation_id BIGINT REFERENCES commission_allocations(id),
    monthly_closing_id BIGINT REFERENCES monthly_commission_closings(id),
    adjustment_type VARCHAR(30) NOT NULL CHECK (adjustment_type IN (
        'REFUND_POOL_REDUCTION',   -- refund/void of unused visits: shrinks outstanding pool only
        'VOID_REVERSAL',           -- a specific allocation reversed (e.g. usage undone before it was billed)
        'RATE_OVERRIDE',           -- admin changed a locked/closed rate after the fact
        'MANUAL_CORRECTION',       -- finance-entered correction with no automated trigger
        'COMPANY_TOP_UP_CORRECTION'
    )),
    -- Signed amounts: a refund or clawback is negative, a correction that adds
    -- pays out is positive. All four move independently because a correction
    -- may touch only the treatment-fee split without changing the gross figure.
    gross_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
    treatment_fee_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
    owner_net_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
    company_top_up_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
    reason TEXT NOT NULL,
    approved_by BIGINT REFERENCES users(id),
    created_by BIGINT NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    reversal_of_id BIGINT REFERENCES commission_adjustments(id)
);

CREATE INDEX idx_commission_adjustments_course ON commission_adjustments(patient_course_id, created_at);
CREATE INDEX idx_commission_adjustments_closing ON commission_adjustments(monthly_closing_id);
CREATE INDEX idx_commission_adjustments_allocation ON commission_adjustments(commission_allocation_id);

-- An allocation reversed by a correction points at the adjustment that did it,
-- so the allocation ledger and the adjustment ledger cross-reference cleanly.
ALTER TABLE commission_allocations ADD COLUMN IF NOT EXISTS adjustment_reference_id BIGINT REFERENCES commission_adjustments(id);

-- The rate a preview shows and the rate actually frozen at close are two
-- different numbers once an admin override can change the second without
-- touching the first. calculated_commission_rate keeps meaning "what the
-- tier table produced"; locked_commission_rate is "what patient_courses in
-- this closing were actually frozen at" (equal unless overridden).
ALTER TABLE monthly_commission_closings ADD COLUMN IF NOT EXISTS commission_scheme_version INTEGER;
ALTER TABLE monthly_commission_closings ADD COLUMN IF NOT EXISTS locked_commission_rate NUMERIC(7,4);
UPDATE monthly_commission_closings SET locked_commission_rate = calculated_commission_rate WHERE locked_commission_rate IS NULL;
UPDATE monthly_commission_closings mc SET commission_scheme_version = s.version
    FROM commission_schemes s WHERE s.id = mc.scheme_id AND mc.commission_scheme_version IS NULL;

-- Lookup index for the treatment-fee resolver: most specific rule
-- (employee_id + service_id) first, filtered by effective window.
CREATE INDEX idx_treatment_fee_rules_lookup ON treatment_fee_rules(employee_id, service_id, effective_from);

-- audit_logs (from V5) has carried no application-written row until now; the
-- existing (entity_type, entity_id, occurred_at) index from V5 already
-- covers the lookups CommissionAuditService needs, so no new index here.
