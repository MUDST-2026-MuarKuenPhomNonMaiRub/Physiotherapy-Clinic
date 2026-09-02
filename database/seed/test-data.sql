-- Safe, repeatable test data for local/Staging flow testing.
-- This is intentionally outside Flyway: production is never seeded automatically.
BEGIN;

INSERT INTO users (email, password_hash, first_name, last_name)
SELECT 'physio.demo@example.com', password_hash, 'Demo', 'Physiotherapist'
FROM users WHERE email = 'admin@example.com'
ON CONFLICT (email) DO NOTHING;

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u CROSS JOIN roles r
WHERE u.email = 'physio.demo@example.com' AND r.code = 'PHYSIO'
ON CONFLICT DO NOTHING;

INSERT INTO staff (name, name_en, position, phone, email, branch_ids, status, user_id)
SELECT 'นักกายภาพทดสอบ', 'Demo Physiotherapist', 'Physiotherapist', '0800000001',
       'physio.demo@example.com', '[' || r9.id || ',' || br.id || ']', 'ACTIVE', u.id
FROM users u
CROSS JOIN branches r9
CROSS JOIN branches br
WHERE u.email = 'physio.demo@example.com' AND r9.code = 'R9' AND br.code = 'BR'
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO services (code, name_th, name_en, service_type, duration_minutes, base_price)
VALUES
  ('DEMO-ASSESS', 'ประเมินอาการทดสอบ', 'Demo Assessment', 'ASSESSMENT', 60, 800),
  ('DEMO-TREAT', 'กายภาพบำบัดทดสอบ', 'Demo Treatment', 'SINGLE_VISIT', 60, 1200)
ON CONFLICT (code) DO NOTHING;

INSERT INTO courses (code, name_th, name_en, total_sessions, validity_days, price)
VALUES ('DEMO-10', 'คอร์สทดลอง 10 ครั้ง', 'Demo 10 Visit Course', 10, 120, 10000)
ON CONFLICT (code) DO NOTHING;

INSERT INTO rooms (branch_id, code, name, room_type)
SELECT b.id, 'DEMO-ROOM', 'ห้องทดสอบ', 'TREATMENT'
FROM branches b WHERE b.code = 'R9'
ON CONFLICT (branch_id, code) DO NOTHING;

INSERT INTO patients (hn, registered_branch_id, customer_type, prefix, first_name_th, last_name_th,
                      first_name_en, last_name_en, nickname, gender_code, birth_date, phone,
                      customer_group_code, referral_channel_code, insurance_company_code)
SELECT '26R9099001', b.id, 'THAI', 'นาย', 'ผู้ป่วยทดสอบ', 'พระรามเก้า',
       'Test', 'RamaNine', 'Test R9', 'MALE', '1990-01-15', '0800000101',
       'WALK_IN', 'DIRECT', 'SELF_PAY'
FROM branches b WHERE b.code = 'R9'
ON CONFLICT (hn) DO NOTHING;

INSERT INTO patients (hn, registered_branch_id, customer_type, prefix, first_name_th, last_name_th,
                      first_name_en, last_name_en, nickname, gender_code, birth_date, phone,
                      customer_group_code, referral_channel_code, insurance_company_code)
SELECT '26BR099001', b.id, 'THAI', 'นางสาว', 'ผู้ป่วยทดสอบ', 'แบริ่ง',
       'Test', 'Bearing', 'Test BR', 'FEMALE', '1992-06-20', '0800000102',
       'MEMBER', 'FACEBOOK', 'SELF_PAY'
FROM branches b WHERE b.code = 'BR'
ON CONFLICT (hn) DO NOTHING;

INSERT INTO course_items (course_id, service_id, quantity, unit_price)
SELECT c.id, s.id, 1, s.base_price
FROM courses c CROSS JOIN services s
WHERE c.code = 'DEMO-10' AND s.code = 'DEMO-TREAT'
ON CONFLICT DO NOTHING;

INSERT INTO sales_transactions (transaction_no, patient_id, branch_id, transaction_type, status,
                                subtotal, total_amount, salesperson_id, created_by)
SELECT 'DEMO-SALE-001', p.id, b.id, 'COURSE', 'PAID', 10000, 10000, st.id, u.id
FROM patients p
JOIN branches b ON b.code = 'R9'
JOIN staff st ON st.email = 'physio.demo@example.com'
JOIN users u ON u.email = 'admin@example.com'
WHERE p.hn = '26R9099001'
ON CONFLICT (transaction_no) DO NOTHING;

INSERT INTO sales_items (sales_transaction_id, item_type, course_id, description_snapshot,
                         quantity, unit_price, total_amount)
SELECT tx.id, 'COURSE', c.id, c.name_th, 1, 10000, 10000
FROM sales_transactions tx CROSS JOIN courses c
WHERE tx.transaction_no = 'DEMO-SALE-001' AND c.code = 'DEMO-10'
  AND NOT EXISTS (SELECT 1 FROM sales_items i WHERE i.sales_transaction_id = tx.id)
;

INSERT INTO payments (payment_no, sales_transaction_id, payment_method_id, amount, reference_no, received_by)
SELECT 'DEMO-PAY-001', tx.id, pm.id, 10000, 'DEMO-CASH-001', u.id
FROM sales_transactions tx
JOIN payment_methods pm ON pm.code = 'CASH'
JOIN users u ON u.email = 'admin@example.com'
WHERE tx.transaction_no = 'DEMO-SALE-001'
ON CONFLICT (payment_no) DO NOTHING;

INSERT INTO patient_courses (course_id, receipt_no, sales_transaction_id, patient_id, package_id,
                             package_name_snapshot, sale_date, sale_month, seller_employee_id,
                             case_owner_employee_id, seller_name_snapshot, course_price, total_visits,
                             commission_scheme_id, provisional_commission_rate, total_course_commission_pool,
                             commission_allocation_per_visit, visits_used, valid_until)
SELECT 'DEMO-PC-001', 'DEMO-SALE-001', tx.id, p.id, c.id, c.name_th, CURRENT_DATE,
       date_trunc('month', CURRENT_DATE)::date, st.id, st.id, st.name, 10000, 10,
       cs.id, 0.05, 500, 50, 2, CURRENT_DATE + 120
FROM sales_transactions tx
JOIN patients p ON p.hn = '26R9099001'
JOIN courses c ON c.code = 'DEMO-10'
JOIN staff st ON st.email = 'physio.demo@example.com'
JOIN commission_schemes cs ON cs.code = 'DEFAULT' AND cs.version = 1
WHERE tx.transaction_no = 'DEMO-SALE-001'
ON CONFLICT (course_id) DO NOTHING;

INSERT INTO appointments (appointment_no, patient_id, branch_id, provider_staff_id, service_id,
                          room_id, starts_at, ends_at, status, patient_note)
SELECT 'DEMO-AP-OPEN', p.id, b.id, st.id, s.id, r.id,
       CURRENT_DATE + 1 + time '10:00', CURRENT_DATE + 1 + time '11:00', 'CONFIRMED', 'นัดหมายทดสอบที่รอให้บริการ'
FROM patients p JOIN branches b ON b.code = 'R9' JOIN staff st ON st.email = 'physio.demo@example.com'
JOIN services s ON s.code = 'DEMO-TREAT' JOIN rooms r ON r.branch_id = b.id AND r.code = 'DEMO-ROOM'
WHERE p.hn = '26R9099001'
ON CONFLICT (appointment_no) DO NOTHING;

INSERT INTO appointments (appointment_no, patient_id, branch_id, provider_staff_id, service_id,
                          room_id, starts_at, ends_at, status, patient_note)
SELECT 'DEMO-AP-DONE', p.id, b.id, st.id, s.id, r.id,
       CURRENT_DATE - 1 + time '14:00', CURRENT_DATE - 1 + time '15:00', 'COMPLETED', 'นัดหมายทดสอบที่เสร็จแล้ว'
FROM patients p JOIN branches b ON b.code = 'R9' JOIN staff st ON st.email = 'physio.demo@example.com'
JOIN services s ON s.code = 'DEMO-TREAT' JOIN rooms r ON r.branch_id = b.id AND r.code = 'DEMO-ROOM'
WHERE p.hn = '26R9099001'
ON CONFLICT (appointment_no) DO NOTHING;

INSERT INTO appointment_events (appointment_id, to_status)
SELECT id, status FROM appointments WHERE appointment_no IN ('DEMO-AP-OPEN', 'DEMO-AP-DONE')
  AND NOT EXISTS (SELECT 1 FROM appointment_events e WHERE e.appointment_id = appointments.id);

INSERT INTO visits (appointment_id, patient_id, branch_id, treating_staff_id, completed_at, status)
SELECT a.id, a.patient_id, a.branch_id, a.provider_staff_id, a.ends_at, 'COMPLETED'
FROM appointments a
WHERE a.appointment_no = 'DEMO-AP-DONE'
ON CONFLICT (appointment_id) DO NOTHING;

INSERT INTO course_ledger_entries (patient_course_id, entry_type, quantity, balance_after, reason)
SELECT pc.id, 'PURCHASE', 10, 10, 'Demo course purchase'
FROM patient_courses pc
WHERE pc.course_id = 'DEMO-PC-001'
  AND NOT EXISTS (SELECT 1 FROM course_ledger_entries l WHERE l.patient_course_id = pc.id);

INSERT INTO course_ledger_entries (patient_course_id, entry_type, quantity, balance_after, reason)
SELECT pc.id, 'TREATMENT', -2, 8, 'Demo completed visits'
FROM patient_courses pc
WHERE pc.course_id = 'DEMO-PC-001'
  AND EXISTS (SELECT 1 FROM course_ledger_entries l WHERE l.patient_course_id = pc.id AND l.entry_type = 'PURCHASE')
  AND NOT EXISTS (SELECT 1 FROM course_ledger_entries l WHERE l.patient_course_id = pc.id AND l.entry_type = 'TREATMENT');

COMMIT;
