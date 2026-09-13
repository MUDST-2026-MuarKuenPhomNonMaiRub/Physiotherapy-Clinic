INSERT INTO branches (code, name, phone, address, active)
VALUES
    ('R9', 'พระราม 9', NULL, 'พระราม 9 กรุงเทพฯ', TRUE),
    ('BR', 'แบริ่ง', NULL, 'ซอยแบริ่ง 4 สมุทรปราการ', TRUE)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    address = EXCLUDED.address,
    active = TRUE,
    deleted_at = NULL;
