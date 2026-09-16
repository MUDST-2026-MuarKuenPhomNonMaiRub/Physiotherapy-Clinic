-- The clinic starts with two access levels, ADMIN and PHYSIO. RECEPTIONIST,
-- FINANCE and REPORT_VIEWER were seeded in V5/V20 but the app never gave them
-- a landing screen, so they are retired here. New job-function roles are
-- created explicitly from Staff & Access instead.
--
-- Done as a new migration rather than by editing V5/V20: those files have
-- already been applied to existing databases, and Flyway refuses to start
-- against any database whose applied checksums no longer match the files.
--
-- A role that an account still holds is kept, so nobody loses their login.
DELETE FROM role_permissions rp
USING roles r
WHERE r.id = rp.role_id
  AND r.code IN ('RECEPTIONIST', 'FINANCE', 'REPORT_VIEWER')
  AND NOT EXISTS (SELECT 1 FROM user_roles ur WHERE ur.role_id = r.id);

DELETE FROM roles r
WHERE r.code IN ('RECEPTIONIST', 'FINANCE', 'REPORT_VIEWER')
  AND NOT EXISTS (SELECT 1 FROM user_roles ur WHERE ur.role_id = r.id);
