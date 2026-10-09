-- Demo data for the commission presentation.
-- Safe to run repeatedly: every record is identified by a DEMO-* key.
-- It does not delete or modify non-demo records.

BEGIN;

INSERT INTO staff (name, name_en, position, phone, branch_ids, status, staff_code,
                   staff_type, commission_eligible)
SELECT 'นิดา (Demo Sales)', 'Nida Demo Sales', 'Salesperson', '0900000001', '["4","5"]',
       'ACTIVE', 'DEMO-SALES-01', 'SALESPERSON', false
WHERE NOT EXISTS (SELECT 1 FROM staff WHERE staff_code='DEMO-SALES-01');

INSERT INTO patients (hn, registered_branch_id, customer_type, prefix, first_name_th,
                      last_name_th, first_name_en, last_name_en, nickname, gender_code,
                      national_id, phone, customer_group_code)
SELECT '26R9090010', 4, 'MEMBER', 'นาย', 'สมชาย', 'เดโม', 'Somchai', 'Demo', 'ชาย',
       'M', '1103700000011', '0812345678', 'MEMBER'
WHERE NOT EXISTS (SELECT 1 FROM patients WHERE hn='26R9090010');

INSERT INTO patients (hn, registered_branch_id, customer_type, prefix, first_name_th,
                      last_name_th, first_name_en, last_name_en, nickname, gender_code,
                      national_id, phone, customer_group_code)
SELECT '26R9090011', 4, 'WALK_IN', 'นางสาว', 'สุดา', 'เดโม', 'Suda', 'Demo', 'สุดา',
       'F', '1103700000022', '0898765432', 'WALK_IN'
WHERE NOT EXISTS (SELECT 1 FROM patients WHERE hn='26R9090011');

INSERT INTO treatment_fee_rules (version, employee_id, service_id, fee_type, fee_value,
                                 effective_from, active)
SELECT 1, s.id, 2, 'FIXED', 150, '2026-01-01', true
FROM staff s
WHERE s.staff_code='DEMO-SALES-01' AND false;

-- The substitute physiotherapist receives a fixed Treatment Fee of ฿150 per visit.
INSERT INTO treatment_fee_rules (version, employee_id, service_id, fee_type, fee_value,
                                 effective_from, active)
SELECT 1, 3, 2, 'FIXED', 150, '2026-01-01', true
WHERE NOT EXISTS (
  SELECT 1 FROM treatment_fee_rules WHERE employee_id=3 AND service_id=2
    AND fee_type='FIXED' AND fee_value=150 AND effective_from='2026-01-01'
);

INSERT INTO commission_rules
  (name, applies_to, target_type, target_service_id, commission_type, value, effective_date, active)
SELECT 'DEMO Single Visit Treatment Fee', 'TREATMENT', 'SERVICE', 2, 'FIXED', 150,
       '2026-01-01', true
WHERE NOT EXISTS (SELECT 1 FROM commission_rules WHERE name='DEMO Single Visit Treatment Fee');

-- Closed-month course: ฿75,000 sales => Tier 3 = 7%, pool ฿5,250, 10 paid visits.
INSERT INTO sales_transactions
  (transaction_no, patient_id, branch_id, transaction_type, status, subtotal,
   discount_amount, tax_amount, total_amount, sold_at, salesperson_id, created_by,
   payment_method_id)
-- Start as a non-course transaction because the schema requires the course FK
-- on COURSE_PURCHASE; it is changed after patient_courses exists.
SELECT 'DEMO-COURSE-SALE-01', p.id, 4, 'SINGLE_VISIT', 'PAID', 75000, 0, 0, 75000,
       '2026-08-15T10:00:00+07:00', s.id, 1, 1
FROM patients p CROSS JOIN staff s
WHERE p.hn='26R9090010' AND s.staff_code='DEMO-SALES-01'
  AND NOT EXISTS (SELECT 1 FROM sales_transactions WHERE transaction_no='DEMO-COURSE-SALE-01');

INSERT INTO sales_items (sales_transaction_id, item_type, course_id, description_snapshot,
                         quantity, unit_price, total_amount, item_kind)
SELECT st.id, 'COURSE', 4, 'DEMO Course 10 Sessions', 1, 75000, 75000, 'BASE'
FROM sales_transactions st
WHERE st.transaction_no='DEMO-COURSE-SALE-01'
  AND NOT EXISTS (SELECT 1 FROM sales_items si WHERE si.sales_transaction_id=st.id);

INSERT INTO payments (payment_no, sales_transaction_id, payment_method_id, amount, status,
                      paid_at, received_by)
SELECT 'DEMO-PAY-COURSE-01', st.id, 1, 75000, 'PAID', '2026-08-15T10:01:00+07:00', 1
FROM sales_transactions st
WHERE st.transaction_no='DEMO-COURSE-SALE-01'
  AND NOT EXISTS (SELECT 1 FROM payments WHERE payment_no='DEMO-PAY-COURSE-01');

INSERT INTO patient_courses
  (course_id, receipt_no, sales_transaction_id, patient_id, package_id, package_name_snapshot,
   sale_date, sale_month, seller_employee_id, case_owner_employee_id, seller_name_snapshot,
   case_owner_name_snapshot, course_price, total_visits, bonus_visits, commission_status,
   commission_scheme_id, commission_scheme_version, provisional_commission_rate,
   locked_commission_rate, total_course_commission_pool, commissionable_visit_count,
   commission_allocation_per_visit, gross_commission_allocated_total,
   owner_net_commission_released_total, substitute_treatment_fee_total, status, valid_until,
   branch_id, net_course_sale_amount)
SELECT 'DEMO-COURSE-LOCKED-01', 'DEMO-REC-COURSE-01', st.id, p.id, 4,
       'DEMO Course 10 Sessions', '2026-08-15', '2026-08-01', s.id, 2, s.name,
       'Case Owner Demo', 75000, 10, 2, 'LOCKED', 1, 1, 0.07, 0.07, 5250, 10, 525, 525,
       375, 150, 'ACTIVE', '2027-04-12', 4, 75000
FROM sales_transactions st
JOIN patients p ON p.hn='26R9090010'
JOIN staff s ON s.staff_code='DEMO-SALES-01'
WHERE st.transaction_no='DEMO-COURSE-SALE-01'
  AND NOT EXISTS (SELECT 1 FROM patient_courses WHERE course_id='DEMO-COURSE-LOCKED-01');

UPDATE sales_transactions st SET transaction_type='COURSE_PURCHASE', patient_course_id=pc.id
FROM patient_courses pc
WHERE st.transaction_no='DEMO-COURSE-SALE-01' AND pc.course_id='DEMO-COURSE-LOCKED-01';

INSERT INTO shared_course_members (patient_course_id, patient_id, role, status)
SELECT pc.id, p.id, 'MEMBER', 'ACTIVE'
FROM patient_courses pc CROSS JOIN patients p
WHERE pc.course_id='DEMO-COURSE-LOCKED-01' AND p.hn='26R9090011'
ON CONFLICT DO NOTHING;

INSERT INTO course_member_balances (patient_course_id, patient_id, allocated_visits, used_visits)
SELECT pc.id, p.id, 10, 1 FROM patient_courses pc JOIN patients p ON p.hn='26R9090010'
WHERE pc.course_id='DEMO-COURSE-LOCKED-01' ON CONFLICT DO NOTHING;
INSERT INTO course_member_balances (patient_course_id, patient_id, allocated_visits, used_visits)
SELECT pc.id, p.id, 2, 0 FROM patient_courses pc JOIN patients p ON p.hn='26R9090011'
WHERE pc.course_id='DEMO-COURSE-LOCKED-01' ON CONFLICT DO NOTHING;

UPDATE patient_courses SET visits_used=1
WHERE course_id='DEMO-COURSE-LOCKED-01';

INSERT INTO monthly_commission_closings
  (closing_month, employee_id, monthly_course_sales, scheme_id, calculated_commission_rate,
   status, closed_at, closed_by, commission_scheme_version, locked_commission_rate)
SELECT '2026-08-01', s.id, 75000, 1, 0.07, 'CLOSED',
       '2026-09-01T09:00:00+07:00', 1, 1, 0.07
FROM staff s
WHERE s.staff_code='DEMO-SALES-01'
  AND NOT EXISTS (SELECT 1 FROM monthly_commission_closings mc
                  WHERE mc.closing_month='2026-08-01' AND mc.employee_id=s.id);

INSERT INTO audit_logs (actor_user_id, branch_id, action, entity_type, entity_id, reason)
SELECT 1, 4, 'SHARE', 'PATIENT_COURSE', pc.id::text, 'Demo shared course for presentation'
FROM patient_courses pc
WHERE pc.course_id='DEMO-COURSE-LOCKED-01'
  AND NOT EXISTS (SELECT 1 FROM audit_logs a WHERE a.entity_type='PATIENT_COURSE'
                  AND a.entity_id=pc.id::text AND a.action='SHARE');

UPDATE patient_courses pc SET monthly_closing_id=mc.id
FROM monthly_commission_closings mc
WHERE pc.course_id='DEMO-COURSE-LOCKED-01' AND mc.closing_month='2026-08-01'
  AND mc.employee_id=pc.seller_employee_id;

INSERT INTO appointments
  (appointment_no, patient_id, branch_id, provider_staff_id, service_id, room_id,
   starts_at, ends_at, status, source, created_by)
SELECT 'DEMO-APPT-COURSE-01', p.id, 4, 3, 2, 1,
       '2026-08-20T13:00:00+07:00', '2026-08-20T13:45:00+07:00', 'CONFIRMED', 'BACKOFFICE', 1
FROM patients p
WHERE p.hn='26R9090010'
  AND NOT EXISTS (SELECT 1 FROM appointments WHERE appointment_no='DEMO-APPT-COURSE-01');

INSERT INTO visits
  (appointment_id, patient_id, branch_id, treating_staff_id, course_id, check_in_at,
   started_at, completed_at, status)
SELECT a.id, a.patient_id, 4, 3, 4, a.starts_at, a.starts_at, a.ends_at, 'COMPLETED'
FROM appointments a
WHERE a.appointment_no='DEMO-APPT-COURSE-01'
  AND NOT EXISTS (SELECT 1 FROM visits v WHERE v.appointment_id=a.id);

INSERT INTO course_ledger_entries
  (patient_course_id, entry_type, quantity, balance_after, related_visit_id, branch_id,
   performed_by_name, created_by, created_at)
SELECT pc.id, 'PURCHASE', 12, 12, NULL, 4, 'System Demo', 1, '2026-08-15T10:00:00+07:00'
FROM patient_courses pc
WHERE pc.course_id='DEMO-COURSE-LOCKED-01'
  AND NOT EXISTS (SELECT 1 FROM course_ledger_entries e WHERE e.patient_course_id=pc.id AND e.entry_type='PURCHASE');
INSERT INTO course_ledger_entries
  (patient_course_id, entry_type, quantity, balance_after, related_visit_id, branch_id,
   performed_by_name, created_by, created_at)
SELECT pc.id, 'TREATMENT', -1, 11, v.id, 4, 'โดเรม่อน', 1, '2026-08-20T13:45:00+07:00'
FROM patient_courses pc JOIN visits v ON v.course_id=4
WHERE pc.course_id='DEMO-COURSE-LOCKED-01'
  AND v.id NOT IN (SELECT COALESCE(related_visit_id, -1) FROM course_ledger_entries WHERE entry_type='TREATMENT');

INSERT INTO course_usages
  (patient_course_id, patient_id, visit_id, course_ledger_entry_id, treating_employee_id,
   case_owner_employee_id, quantity, usage_date, status, branch_id, created_by)
SELECT pc.id, pc.patient_id, v.id, e.id, 3, 2, 1, '2026-08-20', 'ALLOCATED', 4, 1
FROM patient_courses pc JOIN visits v ON v.course_id=4
JOIN course_ledger_entries e ON e.patient_course_id=pc.id AND e.related_visit_id=v.id
WHERE pc.course_id='DEMO-COURSE-LOCKED-01'
  AND NOT EXISTS (SELECT 1 FROM course_usages cu WHERE cu.patient_course_id=pc.id);

INSERT INTO commission_allocations
  (visit_id, patient_course_id, patient_id, case_owner_employee_id, treating_employee_id,
   visit_date, gross_commission_allocation, treatment_fee_rule_id, treatment_fee_type,
   treatment_fee_rate_or_amount, treatment_fee_calculation_base, treatment_fee_amount,
   owner_net_commission, company_top_up_amount, overflow_policy_used, course_usage_id,
   visit_qty, allocation_status, created_by)
SELECT v.id, pc.id, pc.patient_id, 2, 3, '2026-08-20', 525, tf.id, 'FIXED', 150, 525, 150,
       375, 0, 'CAP_AT_COMMISSION', cu.id, 1, 'ALLOCATED', 1
FROM patient_courses pc JOIN visits v ON v.course_id=4
JOIN course_usages cu ON cu.patient_course_id=pc.id AND cu.visit_id=v.id
JOIN treatment_fee_rules tf ON tf.employee_id=3 AND tf.service_id=2 AND tf.active
WHERE pc.course_id='DEMO-COURSE-LOCKED-01'
  AND NOT EXISTS (SELECT 1 FROM commission_allocations ca WHERE ca.course_usage_id=cu.id);

INSERT INTO audit_logs (actor_user_id, branch_id, action, entity_type, entity_id, reason)
SELECT 1, 4, 'CLOSE', 'MONTHLY_CLOSING', mc.id::text, 'Demo data for presentation'
FROM monthly_commission_closings mc
JOIN staff s ON s.id=mc.employee_id
WHERE s.staff_code='DEMO-SALES-01' AND mc.closing_month='2026-08-01'
  AND NOT EXISTS (SELECT 1 FROM audit_logs a WHERE a.entity_type='MONTHLY_CLOSING' AND a.entity_id=mc.id::text);

-- Open/provisional course with one pending usage for the before-closing demo.
INSERT INTO sales_transactions
  (transaction_no, patient_id, branch_id, transaction_type, status, subtotal, total_amount,
   sold_at, salesperson_id, created_by, payment_method_id)
SELECT 'DEMO-COURSE-SALE-02', p.id, 4, 'SINGLE_VISIT', 'PAID', 15000, 15000,
       '2026-09-05T11:00:00+07:00', s.id, 1, 1
FROM patients p CROSS JOIN staff s
WHERE p.hn='26R9090010' AND s.staff_code='DEMO-SALES-01'
  AND NOT EXISTS (SELECT 1 FROM sales_transactions WHERE transaction_no='DEMO-COURSE-SALE-02');
INSERT INTO patient_courses
  (course_id, receipt_no, sales_transaction_id, patient_id, package_id, package_name_snapshot,
   sale_date, sale_month, seller_employee_id, case_owner_employee_id, seller_name_snapshot,
   case_owner_name_snapshot, course_price, total_visits, bonus_visits, commission_status,
   commission_scheme_id, commission_scheme_version, provisional_commission_rate,
   total_course_commission_pool, commissionable_visit_count, status, valid_until, branch_id,
   net_course_sale_amount)
SELECT 'DEMO-COURSE-PENDING-01', 'DEMO-REC-COURSE-02', st.id, p.id, 1,
       'DEMO Course Pending Rate', '2026-09-05', '2026-09-01', s.id, 2, s.name,
       'Case Owner Demo', 15000, 10, 1, 'PROVISIONAL', 1, 1, 0.05, 750, 10,
       'ACTIVE', '2027-03-04', 4, 15000
FROM sales_transactions st JOIN patients p ON p.hn='26R9090010'
JOIN staff s ON s.staff_code='DEMO-SALES-01'
WHERE st.transaction_no='DEMO-COURSE-SALE-02'
  AND NOT EXISTS (SELECT 1 FROM patient_courses WHERE course_id='DEMO-COURSE-PENDING-01');
UPDATE sales_transactions st SET transaction_type='COURSE_PURCHASE', patient_course_id=pc.id
FROM patient_courses pc
WHERE st.transaction_no='DEMO-COURSE-SALE-02' AND pc.course_id='DEMO-COURSE-PENDING-01';
INSERT INTO sales_items (sales_transaction_id, item_type, course_id, description_snapshot,
                         quantity, unit_price, total_amount, item_kind)
SELECT st.id, 'COURSE', 1, 'DEMO Course Pending Rate', 1, 15000, 15000, 'BASE'
FROM sales_transactions st
WHERE st.transaction_no='DEMO-COURSE-SALE-02'
  AND NOT EXISTS (SELECT 1 FROM sales_items si WHERE si.sales_transaction_id=st.id);
INSERT INTO payments (payment_no, sales_transaction_id, payment_method_id, amount, status,
                      paid_at, received_by)
SELECT 'DEMO-PAY-COURSE-02', st.id, 1, 15000, 'PAID', '2026-09-05T11:01:00+07:00', 1
FROM sales_transactions st
WHERE st.transaction_no='DEMO-COURSE-SALE-02'
  AND NOT EXISTS (SELECT 1 FROM payments WHERE payment_no='DEMO-PAY-COURSE-02');
INSERT INTO shared_course_members (patient_course_id, patient_id, role, status)
SELECT pc.id, pc.patient_id, 'OWNER', 'ACTIVE' FROM patient_courses pc
WHERE pc.course_id='DEMO-COURSE-PENDING-01' ON CONFLICT DO NOTHING;
INSERT INTO course_member_balances (patient_course_id, patient_id, allocated_visits, used_visits)
SELECT pc.id, pc.patient_id, 11, 1 FROM patient_courses pc
WHERE pc.course_id='DEMO-COURSE-PENDING-01' ON CONFLICT DO NOTHING;
UPDATE patient_courses SET visits_used=1
WHERE course_id='DEMO-COURSE-PENDING-01';
INSERT INTO course_ledger_entries
  (patient_course_id, entry_type, quantity, balance_after, branch_id, performed_by_name, created_by)
SELECT pc.id, 'PURCHASE', 11, 11, 4, 'System Demo', 1 FROM patient_courses pc
WHERE pc.course_id='DEMO-COURSE-PENDING-01'
  AND NOT EXISTS (SELECT 1 FROM course_ledger_entries e WHERE e.patient_course_id=pc.id);
INSERT INTO course_ledger_entries
  (patient_course_id, entry_type, quantity, balance_after, branch_id, performed_by_name, created_by)
SELECT pc.id, 'TREATMENT', -1, 10, 4, 'โดเรม่อน', 1 FROM patient_courses pc
WHERE pc.course_id='DEMO-COURSE-PENDING-01'
  AND NOT EXISTS (SELECT 1 FROM course_ledger_entries e WHERE e.patient_course_id=pc.id AND e.entry_type='TREATMENT');
INSERT INTO course_usages
  (patient_course_id, patient_id, quantity, usage_date, status, treating_employee_id,
   case_owner_employee_id, branch_id, created_by)
SELECT pc.id, pc.patient_id, 1, '2026-09-10', 'PENDING_RATE', 3, 2, 4, 1
FROM patient_courses pc
WHERE pc.course_id='DEMO-COURSE-PENDING-01'
  AND NOT EXISTS (SELECT 1 FROM course_usages cu WHERE cu.patient_course_id=pc.id);

-- Voided line for the legacy commission report's Active/Voided view.
INSERT INTO sales_transactions
  (transaction_no, patient_id, branch_id, transaction_type, status, subtotal, total_amount,
   sold_at, salesperson_id, created_by, payment_method_id, cancelled_at)
SELECT 'DEMO-VOID-SALE-01', p.id, 4, 'SINGLE_VISIT', 'CANCELLED', 900, 900,
       '2026-09-06T12:00:00+07:00', s.id, 1, 1, '2026-09-06T12:30:00+07:00'
FROM patients p CROSS JOIN staff s
WHERE p.hn='26R9090010' AND s.staff_code='DEMO-SALES-01'
  AND NOT EXISTS (SELECT 1 FROM sales_transactions WHERE transaction_no='DEMO-VOID-SALE-01');
INSERT INTO transaction_commissions
  (sales_transaction_id, rule_name_snapshot, staff_id, commission_type, amount)
SELECT st.id, 'Demo sales commission', s.id, 'SALES', 90
FROM sales_transactions st CROSS JOIN staff s
WHERE st.transaction_no='DEMO-VOID-SALE-01' AND s.staff_code='DEMO-SALES-01'
  AND NOT EXISTS (SELECT 1 FROM transaction_commissions tc WHERE tc.sales_transaction_id=st.id);
INSERT INTO transaction_cancellations (transaction_id, reason_code, reason_text, cancelled_by)
SELECT st.id, 'DEMO_VOID', 'Demo void for presentation', 1
FROM sales_transactions st
WHERE st.transaction_no='DEMO-VOID-SALE-01'
  AND NOT EXISTS (SELECT 1 FROM transaction_cancellations tc WHERE tc.transaction_id=st.id);

-- Active single-visit example: no salesperson, treatment fee goes directly to
-- the treating therapist and appears in Reports > Commission.
INSERT INTO sales_transactions
  (transaction_no, patient_id, branch_id, transaction_type, status, subtotal, total_amount,
   sold_at, treating_staff_id, created_by, payment_method_id)
SELECT 'DEMO-SINGLE-SALE-01', p.id, 4, 'SINGLE_VISIT', 'PAID', 900, 900,
       '2026-09-08T14:00:00+07:00', 3, 1, 1
FROM patients p
WHERE p.hn='26R9090010'
  AND NOT EXISTS (SELECT 1 FROM sales_transactions WHERE transaction_no='DEMO-SINGLE-SALE-01');
INSERT INTO sales_items (sales_transaction_id, item_type, service_id, description_snapshot,
                         quantity, unit_price, total_amount, item_kind)
SELECT st.id, 'SERVICE', 2, 'Office Syndrome Treatment', 1, 900, 900, 'BASE'
FROM sales_transactions st
WHERE st.transaction_no='DEMO-SINGLE-SALE-01'
  AND NOT EXISTS (SELECT 1 FROM sales_items si WHERE si.sales_transaction_id=st.id);
INSERT INTO payments (payment_no, sales_transaction_id, payment_method_id, amount, status,
                      paid_at, received_by)
SELECT 'DEMO-PAY-SINGLE-01', st.id, 1, 900, 'PAID', '2026-09-08T14:01:00+07:00', 1
FROM sales_transactions st
WHERE st.transaction_no='DEMO-SINGLE-SALE-01'
  AND NOT EXISTS (SELECT 1 FROM payments WHERE payment_no='DEMO-PAY-SINGLE-01');
INSERT INTO transaction_commissions
  (sales_transaction_id, commission_rule_id, rule_name_snapshot, staff_id, commission_type, amount)
SELECT st.id, cr.id, cr.name, 3, 'TREATMENT', 150
FROM sales_transactions st JOIN commission_rules cr ON cr.name='DEMO Single Visit Treatment Fee'
WHERE st.transaction_no='DEMO-SINGLE-SALE-01'
  AND NOT EXISTS (SELECT 1 FROM transaction_commissions tc WHERE tc.sales_transaction_id=st.id);

COMMIT;
