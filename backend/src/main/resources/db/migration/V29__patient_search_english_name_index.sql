-- Support server-side patient search by English first or last name without scanning the full table.
CREATE INDEX IF NOT EXISTS idx_patients_names_en_trgm
  ON patients USING gin ((COALESCE(first_name_en, '') || ' ' || COALESCE(last_name_en, '')) gin_trgm_ops)
  WHERE deleted_at IS NULL;
