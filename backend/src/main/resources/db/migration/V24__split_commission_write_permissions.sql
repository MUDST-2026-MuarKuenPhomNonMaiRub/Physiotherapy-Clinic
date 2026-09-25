-- Closing a month, adjusting a course's commission and sharing a course are
-- writes with money behind them; until now they sat behind view permissions
-- (commission.view.all, course.view), so any role that could *see* the
-- commission report could also close the month. Each gets its own permission.
INSERT INTO permissions(code,name) VALUES
 ('commission.close','Close the monthly commission period'),
 ('commission.adjust','Refund or adjust course commission'),
 ('course.share','Share a course with another patient')
ON CONFLICT (code) DO NOTHING;

-- ADMIN bypasses the guard, but its role_permissions rows are what the UI
-- reads to decide which screens to show, so it is granted explicitly.
INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN
  ('commission.close','commission.adjust','course.share')
WHERE r.code = 'ADMIN'
ON CONFLICT DO NOTHING;

-- Sharing was previously reachable by anyone holding course.transfer (the
-- screen's own gate), so the built-in therapist role keeps that ability.
INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code = 'course.share'
WHERE r.code = 'PHYSIO'
ON CONFLICT DO NOTHING;
