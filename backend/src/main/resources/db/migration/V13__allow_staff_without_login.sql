-- Salespeople are selectable in checkout and reports but do not need a login.
ALTER TABLE staff ALTER COLUMN email DROP NOT NULL;
ALTER TABLE staff ALTER COLUMN user_id DROP NOT NULL;
