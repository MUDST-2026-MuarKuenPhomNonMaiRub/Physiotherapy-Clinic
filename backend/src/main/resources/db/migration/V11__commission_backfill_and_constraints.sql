-- One-time backfill so every patient_course sold before this release fits
-- the shapes the new pool/allocation pipeline expects, and a one-time,
-- one-directional cutover tag so none of them can be double-paid. Nothing
-- here fabricates commission history that never happened: no
-- commission_allocations row is created for a historical visit, and
-- transaction_commissions (the old immediate-SALES-commission ledger) is
-- read here only to compute a discount ratio — never modified or deleted.

-- --------------------------------------------------------------------------
-- 1. Every patient_course gets an OWNER row and a balance row, including the
--    ones sold before shared-course/member-balance tracking existed. This
--    was already done selectively for OWNER rows in V6; this repeats it
--    idempotently for any patient_course V6 missed (course_price=0 transfer
--    targets, courses created outside a sale) and is a no-op for the rest.
-- --------------------------------------------------------------------------
INSERT INTO shared_course_members (patient_course_id, patient_id, role, status)
SELECT pc.id, pc.patient_id, 'OWNER', 'ACTIVE'
FROM patient_courses pc
ON CONFLICT (patient_course_id, patient_id) DO NOTHING;

INSERT INTO course_member_balances (patient_course_id, patient_id, allocated_visits, used_visits)
SELECT pc.id, pc.patient_id,
       GREATEST(pc.total_visits + pc.bonus_visits + pc.transfer_in_visits - pc.transfer_out_visits, pc.visits_used),
       pc.visits_used
FROM patient_courses pc
ON CONFLICT (patient_course_id, patient_id) DO NOTHING;

-- --------------------------------------------------------------------------
-- 2. Snapshot columns the new pool math reads. net_course_sale_amount
--    defaults to the recorded course price, then gets apportioned by the
--    same discount ratio checkout applies at sale time wherever the sale's
--    transaction shows a discount — matching how a new sale computes it.
--    commissionable_visit_count is the paid-visit denominator (bonus visits
--    are not part of it, per the "pool divides paid visits only" rule).
-- --------------------------------------------------------------------------
UPDATE patient_courses
SET net_course_sale_amount = COALESCE(net_course_sale_amount, course_price),
    commissionable_visit_count = COALESCE(commissionable_visit_count, total_visits),
    case_owner_name_snapshot = COALESCE(NULLIF(case_owner_name_snapshot, ''), NULLIF(seller_name_snapshot, ''))
WHERE net_course_sale_amount IS NULL
   OR commissionable_visit_count IS NULL
   OR case_owner_name_snapshot IS NULL;

UPDATE patient_courses pc
SET net_course_sale_amount = round(pc.course_price * (st.subtotal - st.discount_amount) / st.subtotal, 2)
FROM sales_transactions st
WHERE pc.sales_transaction_id = st.id
  AND st.subtotal > 0
  AND st.discount_amount > 0;

-- --------------------------------------------------------------------------
-- 3. Cutover: every patient_course that already existed before this release
--    was paid out in full at sale time via transaction_commissions (or, for
--    a transfer target, carries no commission at all). None of them may
--    enter the new monthly-closing / per-visit release pipeline, or the
--    seller would be paid twice for the same sale. This UPDATE runs exactly
--    once (Flyway never re-applies an executed migration) and nothing later
--    moves a course back out of LEGACY_EXCLUDED — a course created after
--    this release starts PROVISIONAL as normal and is never touched here.
-- --------------------------------------------------------------------------
UPDATE patient_courses SET commission_status = 'LEGACY_EXCLUDED' WHERE commission_status <> 'LEGACY_EXCLUDED';

-- --------------------------------------------------------------------------
-- 4. Give historical usage a queryable lineage row (LEGACY_UNALLOCATED)
--    without inventing an allocation that never happened. Only ledger
--    entries that already exist are covered; treating/case-owner employee is
--    filled in on a best-effort basis (visit was never linked historically)
--    and left NULL, which LEGACY_UNALLOCATED status explicitly allows, when
--    nothing on the course or its transaction names one.
-- --------------------------------------------------------------------------
INSERT INTO course_usages (
    patient_course_id, patient_id, sales_transaction_id, course_ledger_entry_id,
    treating_employee_id, case_owner_employee_id, quantity, usage_date, status,
    branch_id, created_by, created_at
)
SELECT
    cle.patient_course_id,
    pc.patient_id,
    cle.related_transaction_id,
    cle.id,
    COALESCE(st.treating_staff_id, pc.case_owner_employee_id, pc.seller_employee_id),
    COALESCE(pc.case_owner_employee_id, pc.seller_employee_id, st.treating_staff_id),
    -cle.quantity,
    cle.created_at::date,
    'LEGACY_UNALLOCATED',
    cle.branch_id,
    cle.created_by,
    cle.created_at
FROM course_ledger_entries cle
JOIN patient_courses pc ON pc.id = cle.patient_course_id
LEFT JOIN sales_transactions st ON st.id = cle.related_transaction_id
WHERE cle.entry_type = 'TREATMENT'
  AND cle.quantity < 0
  AND NOT EXISTS (SELECT 1 FROM course_usages cu WHERE cu.course_ledger_entry_id = cle.id);

-- --------------------------------------------------------------------------
-- 5. sales_transactions.patient_course_id: required going forward for any
--    course-bearing transaction type, but NOT VALID so this migration does
--    not fail (or block) on pre-existing rows with gaps. Existing rows are
--    left exactly as they are — see the reconciliation query below to find
--    and fix them, then VALIDATE CONSTRAINT in a follow-up migration once
--    they are clean.
-- --------------------------------------------------------------------------
ALTER TABLE sales_transactions ADD CONSTRAINT chk_sales_transactions_course_purchase_has_course
    CHECK (transaction_type NOT IN ('COURSE_PURCHASE', 'MIXED') OR patient_course_id IS NOT NULL) NOT VALID;

-- --------------------------------------------------------------------------
-- Reconciliation (read-only, for the deploy checklist — not enforced here):
--
--   -- Courses with no seller/case-owner: closeMonth already skips these
--   -- (it groups by seller_employee_id), but they can never be closed until
--   -- fixed by hand.
--   SELECT id, course_id, patient_id, sale_month
--   FROM patient_courses WHERE seller_employee_id IS NULL OR case_owner_employee_id IS NULL;
--
--   -- Legacy usage that could not be attributed to any staff member.
--   SELECT id, patient_course_id, course_ledger_entry_id
--   FROM course_usages WHERE status = 'LEGACY_UNALLOCATED'
--     AND (treating_employee_id IS NULL OR case_owner_employee_id IS NULL);
--
--   -- COURSE_PURCHASE/MIXED transactions missing patient_course_id, i.e. the
--   -- rows the NOT VALID check above does not yet enforce.
--   SELECT id, transaction_no, transaction_type
--   FROM sales_transactions
--   WHERE transaction_type IN ('COURSE_PURCHASE', 'MIXED') AND patient_course_id IS NULL;
-- --------------------------------------------------------------------------
