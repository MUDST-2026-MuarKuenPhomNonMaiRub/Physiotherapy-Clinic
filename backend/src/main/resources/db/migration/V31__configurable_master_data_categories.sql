CREATE TABLE master_data_categories (
  code VARCHAR(60) PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  description VARCHAR(300) NOT NULL DEFAULT '',
  built_in BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  deleted_at TIMESTAMPTZ
);

INSERT INTO master_data_categories(code,name,description,built_in,sort_order) VALUES
('CUSTOMER_GROUP','Customer Group','Segments used on patient registration',TRUE,1),
('REFERRAL_CHANNEL','Referral Channel','How patients heard about the clinic',TRUE,2),
('INSURANCE_COMPANY','Insurance Company','Insurers recorded on patient profiles',TRUE,3);

-- Preserve any pre-existing custom types instead of hiding their values.
INSERT INTO master_data_categories(code,name,sort_order)
SELECT DISTINCT data_type,data_type,4 FROM master_data_values
ON CONFLICT (code) DO NOTHING;

CREATE UNIQUE INDEX master_data_categories_name_unique ON master_data_categories(lower(btrim(name))) WHERE deleted_at IS NULL;

-- Keep historical references while removing choices from future use.
ALTER TABLE payment_methods ADD COLUMN deleted_at TIMESTAMPTZ;
ALTER TABLE master_data_values ADD COLUMN deleted_at TIMESTAMPTZ;
