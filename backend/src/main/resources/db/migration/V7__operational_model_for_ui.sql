-- Brings the persisted model up to what the clinic UI actually works with:
-- bonus sessions on a course, transfer counters and a branch on a patient
-- course, adjustment lines on a sale, and the per-transaction commission that
-- the checkout screen prints on its receipt.

-- --------------------------------------------------------------------------
-- Catalogue
-- --------------------------------------------------------------------------
ALTER TABLE courses ADD COLUMN IF NOT EXISTS bonus_sessions INTEGER NOT NULL DEFAULT 0 CHECK (bonus_sessions >= 0);
ALTER TABLE courses ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';

ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS icon VARCHAR(40) NOT NULL DEFAULT 'Wallet';
ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

UPDATE payment_methods SET icon = 'Banknote',   sort_order = 1 WHERE code = 'CASH';
UPDATE payment_methods SET icon = 'Landmark',   sort_order = 2 WHERE code = 'TRANSFER';
UPDATE payment_methods SET icon = 'QrCode',     sort_order = 3 WHERE code = 'QR';
UPDATE payment_methods SET icon = 'CreditCard', sort_order = 4 WHERE code = 'CARD';

-- --------------------------------------------------------------------------
-- Patients: the registration form captures a few fields the table did not hold
-- --------------------------------------------------------------------------
ALTER TABLE patients ADD COLUMN IF NOT EXISTS national_id VARCHAR(30);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS passport_no VARCHAR(30);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS address_text TEXT NOT NULL DEFAULT '';

-- --------------------------------------------------------------------------
-- Rooms / resources: the UI treats a room as active or inactive per branch
-- --------------------------------------------------------------------------
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- --------------------------------------------------------------------------
-- Commission rules: a per-item rule the counter applies at checkout. This is
-- deliberately separate from commission_schemes/tiers, which model the monthly
-- course-pool payout rather than the line-level commission on a receipt.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS commission_rules (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    applies_to VARCHAR(20) NOT NULL CHECK (applies_to IN ('TREATMENT', 'SALES', 'BOTH')),
    target_type VARCHAR(20) NOT NULL CHECK (target_type IN ('SERVICE', 'COURSE', 'ALL')),
    target_service_id BIGINT REFERENCES services(id),
    target_course_id BIGINT REFERENCES courses(id),
    commission_type VARCHAR(20) NOT NULL CHECK (commission_type IN ('PERCENTAGE', 'FIXED')),
    value NUMERIC(14, 2) NOT NULL CHECK (value >= 0),
    effective_date DATE NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (target_type <> 'SERVICE' OR target_course_id IS NULL),
    CHECK (target_type <> 'COURSE' OR target_service_id IS NULL),
    CHECK (target_type <> 'ALL' OR (target_service_id IS NULL AND target_course_id IS NULL))
);

-- --------------------------------------------------------------------------
-- Sales: an appointment origin, the treating staff, and signed adjustment lines
-- --------------------------------------------------------------------------
ALTER TABLE sales_transactions ADD COLUMN IF NOT EXISTS appointment_id BIGINT REFERENCES appointments(id);
ALTER TABLE sales_transactions ADD COLUMN IF NOT EXISTS treating_staff_id BIGINT REFERENCES staff(id);
ALTER TABLE sales_transactions ADD COLUMN IF NOT EXISTS payment_method_id BIGINT REFERENCES payment_methods(id);
ALTER TABLE sales_transactions ADD COLUMN IF NOT EXISTS patient_course_id BIGINT;

-- A DISCOUNT line carries a negative amount so the items always sum to the total.
ALTER TABLE sales_items ADD COLUMN IF NOT EXISTS item_kind VARCHAR(20) NOT NULL DEFAULT 'BASE'
    CHECK (item_kind IN ('BASE', 'SURCHARGE', 'DISCOUNT'));
ALTER TABLE sales_items DROP CONSTRAINT IF EXISTS sales_items_unit_price_check;
ALTER TABLE sales_items DROP CONSTRAINT IF EXISTS sales_items_total_amount_check;
ALTER TABLE sales_items ADD CONSTRAINT sales_items_amount_sign
    CHECK ((item_kind = 'DISCOUNT' AND total_amount <= 0) OR (item_kind <> 'DISCOUNT' AND total_amount >= 0));

-- The commission the receipt shows, resolved against the rule that was live
-- when the sale happened. Kept per transaction so a later rule edit cannot
-- silently restate a closed receipt.
CREATE TABLE IF NOT EXISTS transaction_commissions (
    id BIGSERIAL PRIMARY KEY,
    sales_transaction_id BIGINT NOT NULL REFERENCES sales_transactions(id),
    commission_rule_id BIGINT REFERENCES commission_rules(id),
    rule_name_snapshot VARCHAR(200) NOT NULL,
    staff_id BIGINT NOT NULL REFERENCES staff(id),
    commission_type VARCHAR(20) NOT NULL CHECK (commission_type IN ('TREATMENT', 'SALES')),
    amount NUMERIC(14, 2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_transaction_commissions_staff ON transaction_commissions(staff_id, sales_transaction_id);

-- --------------------------------------------------------------------------
-- Patient courses: bonus and transfer counters, plus a branch. A course created
-- by a transfer has no sale behind it, so the sale-side columns become optional.
-- --------------------------------------------------------------------------
ALTER TABLE patient_courses ADD COLUMN IF NOT EXISTS bonus_visits INTEGER NOT NULL DEFAULT 0 CHECK (bonus_visits >= 0);
ALTER TABLE patient_courses ADD COLUMN IF NOT EXISTS transfer_in_visits INTEGER NOT NULL DEFAULT 0 CHECK (transfer_in_visits >= 0);
ALTER TABLE patient_courses ADD COLUMN IF NOT EXISTS transfer_out_visits INTEGER NOT NULL DEFAULT 0 CHECK (transfer_out_visits >= 0);
ALTER TABLE patient_courses ADD COLUMN IF NOT EXISTS branch_id BIGINT REFERENCES branches(id);

ALTER TABLE patient_courses ALTER COLUMN sales_transaction_id DROP NOT NULL;
ALTER TABLE patient_courses ALTER COLUMN receipt_no DROP NOT NULL;
ALTER TABLE patient_courses ALTER COLUMN seller_employee_id DROP NOT NULL;
ALTER TABLE patient_courses ALTER COLUMN case_owner_employee_id DROP NOT NULL;
ALTER TABLE patient_courses ALTER COLUMN seller_name_snapshot DROP NOT NULL;

-- visits_used <= total_visits no longer holds once bonus and transferred visits
-- are spendable; the balance is checked against the full entitlement instead.
ALTER TABLE patient_courses DROP CONSTRAINT IF EXISTS patient_courses_check1;
ALTER TABLE patient_courses DROP CONSTRAINT IF EXISTS patient_courses_check;
ALTER TABLE patient_courses ADD CONSTRAINT patient_courses_balance_not_negative
    CHECK (visits_used + transfer_out_visits <= total_visits + bonus_visits + transfer_in_visits);

-- A course created by an incoming transfer was never purchased, so it starts
-- with no visits of its own.
ALTER TABLE patient_courses DROP CONSTRAINT IF EXISTS patient_courses_total_visits_check;
ALTER TABLE patient_courses ADD CONSTRAINT patient_courses_total_visits_check CHECK (total_visits >= 0);

-- --------------------------------------------------------------------------
-- Course ledger: every balance change is an entry, and each entry says which
-- branch it happened at, who performed it, and what it was tied to.
-- --------------------------------------------------------------------------
ALTER TABLE course_ledger_entries ADD COLUMN IF NOT EXISTS branch_id BIGINT REFERENCES branches(id);
ALTER TABLE course_ledger_entries ADD COLUMN IF NOT EXISTS related_transaction_id BIGINT REFERENCES sales_transactions(id);
ALTER TABLE course_ledger_entries ADD COLUMN IF NOT EXISTS transfer_group_id VARCHAR(60);
ALTER TABLE course_ledger_entries ADD COLUMN IF NOT EXISTS counterparty_patient_id BIGINT REFERENCES patients(id);
ALTER TABLE course_ledger_entries ADD COLUMN IF NOT EXISTS performed_by_name VARCHAR(200) NOT NULL DEFAULT '';

ALTER TABLE course_transfers ADD COLUMN IF NOT EXISTS to_patient_course_id BIGINT REFERENCES patient_courses(id);

-- --------------------------------------------------------------------------
-- Users: the access screen shows when an account was last used
-- --------------------------------------------------------------------------
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ;

-- --------------------------------------------------------------------------
-- Starting catalogue. Back office can edit all of it; without it the clinic
-- screens would open with nothing to select.
-- --------------------------------------------------------------------------
INSERT INTO services (code, name_th, name_en, service_type, duration_minutes, base_price) VALUES
    ('SVC-ASSESS', 'Physical Assessment',            'Physical Assessment',            'ASSESSMENT',   30, 500),
    ('SVC-OFFICE', 'Office Syndrome Treatment',      'Office Syndrome Treatment',      'SINGLE_VISIT', 45, 900),
    ('SVC-SPORTS', 'Sports Injury Rehabilitation',   'Sports Injury Rehabilitation',   'SINGLE_VISIT', 60, 1200),
    ('SVC-BACK',   'Lower Back Pain Therapy',        'Lower Back Pain Therapy',        'SINGLE_VISIT', 45, 1000),
    ('SVC-POSTOP', 'Post-Operative Rehabilitation',  'Post-Operative Rehabilitation',  'SINGLE_VISIT', 60, 1400),
    ('SVC-NEURO',  'Neurological Rehabilitation',    'Neurological Rehabilitation',    'SINGLE_VISIT', 60, 1500)
ON CONFLICT (code) DO NOTHING;

INSERT INTO courses (code, name_th, name_en, total_sessions, bonus_sessions, validity_days, price, description) VALUES
    ('CRS-OFFICE10', 'Office Syndrome 10 Sessions',  'Office Syndrome 10 Sessions',  10, 1, 180, 8100,  'Ten office-syndrome treatments with one bonus session.'),
    ('CRS-BACK5',    'Lower Back Pain 5 Sessions',   'Lower Back Pain 5 Sessions',    5, 0, 120, 4500,  'Five lower-back therapy sessions.'),
    ('CRS-SPORTS8',  'Sports Rehabilitation 8 Sessions', 'Sports Rehabilitation 8 Sessions', 8, 1, 180, 8800, 'Eight sports-rehabilitation sessions with one bonus session.'),
    ('CRS-POSTOP12', 'Post-Operative 12 Sessions',   'Post-Operative 12 Sessions',   12, 2, 240, 15000, 'Twelve post-operative sessions with two bonus sessions.')
ON CONFLICT (code) DO NOTHING;

INSERT INTO master_data_values (data_type, code, name_th, name_en, sort_order, active) VALUES
    ('CUSTOMER_GROUP',    'WALKIN',    'Walk-in',          'Walk-in',          1, TRUE),
    ('CUSTOMER_GROUP',    'MEMBER',    'Member',           'Member',           2, TRUE),
    ('CUSTOMER_GROUP',    'VIP',       'VIP',              'VIP',              3, TRUE),
    ('CUSTOMER_GROUP',    'CORPORATE', 'Corporate',        'Corporate',        4, TRUE),
    ('CUSTOMER_GROUP',    'STAFF',     'Staff / Family',   'Staff / Family',   5, FALSE),
    ('REFERRAL_CHANNEL',  'FACEBOOK',  'Facebook',         'Facebook',         1, TRUE),
    ('REFERRAL_CHANNEL',  'INSTAGRAM', 'Instagram',        'Instagram',        2, TRUE),
    ('REFERRAL_CHANNEL',  'GOOGLE',    'Google Search',    'Google Search',    3, TRUE),
    ('REFERRAL_CHANNEL',  'FRIEND',    'Friend Referral',  'Friend Referral',  4, TRUE),
    ('REFERRAL_CHANNEL',  'DOCTOR',    'Doctor Referral',  'Doctor Referral',  5, TRUE),
    ('REFERRAL_CHANNEL',  'WALKBY',    'Walk-by',          'Walk-by',          6, TRUE),
    ('REFERRAL_CHANNEL',  'LINE',      'LINE Official',    'LINE Official',    7, FALSE),
    ('INSURANCE_COMPANY', 'NONE',      'None / Self-pay',  'None / Self-pay',  1, TRUE),
    ('INSURANCE_COMPANY', 'AIA',       'AIA',              'AIA',              2, TRUE),
    ('INSURANCE_COMPANY', 'BUPA',      'Bupa Thailand',    'Bupa Thailand',    3, TRUE),
    ('INSURANCE_COMPANY', 'ALLIANZ',   'Allianz Ayudhya',  'Allianz Ayudhya',  4, TRUE),
    ('INSURANCE_COMPANY', 'MUANGTHAI', 'Muang Thai Life',  'Muang Thai Life',  5, FALSE)
ON CONFLICT (data_type, code) DO NOTHING;

INSERT INTO rooms (branch_id, code, name, room_type, active)
SELECT b.id, r.code, r.name, r.room_type, TRUE
FROM branches b
CROSS JOIN (VALUES
    ('TR1', 'Treatment Room 1', 'Treatment Room'),
    ('TR2', 'Treatment Room 2', 'Treatment Room'),
    ('EX1', 'Exercise Area',    'Open Area'),
    ('RL1', 'Running Lab',      'Specialty Room')
) AS r(code, name, room_type)
WHERE b.active AND b.deleted_at IS NULL
ON CONFLICT (branch_id, code) DO NOTHING;

INSERT INTO commission_rules (name, applies_to, target_type, target_service_id, commission_type, value, effective_date, active)
SELECT 'Standard Treatment Commission', 'TREATMENT', 'ALL', NULL, 'PERCENTAGE', 5, '2026-01-01', TRUE
WHERE NOT EXISTS (SELECT 1 FROM commission_rules);

INSERT INTO commission_rules (name, applies_to, target_type, target_service_id, commission_type, value, effective_date, active)
SELECT 'Office Syndrome Treatment Commission', 'TREATMENT', 'SERVICE', s.id, 'PERCENTAGE', 6, '2026-01-01', TRUE
FROM services s
WHERE s.code = 'SVC-OFFICE'
  AND NOT EXISTS (SELECT 1 FROM commission_rules WHERE name = 'Office Syndrome Treatment Commission');

INSERT INTO commission_rules (name, applies_to, target_type, commission_type, value, effective_date, active)
SELECT 'Course Sales Commission', 'SALES', 'COURSE', 'PERCENTAGE', 8, '2026-01-01', TRUE
WHERE NOT EXISTS (SELECT 1 FROM commission_rules WHERE name = 'Course Sales Commission');

INSERT INTO commission_rules (name, applies_to, target_type, commission_type, value, effective_date, active)
SELECT 'Single Visit Sales Commission', 'SALES', 'SERVICE', 'FIXED', 50, '2026-01-01', TRUE
WHERE NOT EXISTS (SELECT 1 FROM commission_rules WHERE name = 'Single Visit Sales Commission');
