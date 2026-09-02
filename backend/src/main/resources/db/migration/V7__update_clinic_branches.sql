INSERT INTO branches (code, name, phone, address, active)
VALUES
    ('R9', 'สาขา พระราม 9 (ใกล้ The nine)', NULL, 'พระราม 9 กรุงเทพฯ', TRUE),
    ('BR', 'สาขา แบริ่ง (ซ.แบริ่ง 4)', NULL, 'ซอยแบริ่ง 4 สมุทรปราการ', TRUE)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    address = EXCLUDED.address,
    active = TRUE,
    deleted_at = NULL;

UPDATE branches
SET active = FALSE, deleted_at = COALESCE(deleted_at, now()), updated_at = now()
WHERE code IN ('BKK', 'SAL', 'CNX');
