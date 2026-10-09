-- RECEPTIONIST, FINANCE and REPORT_VIEWER were seeded as roles in V5 but never
-- given role_permissions rows, so PermissionGuard fell back to a hardcoded
-- Java-side matrix for them. That fallback made the Role management screen a
-- silent no-op for these three roles: editing their permissions there wrote
-- to role_permissions, which nothing was reading for these roles. Seeding the
-- same grants the fallback used to imply, as real rows, is what the UI edits
-- from here on. The fallback itself is dropped in PermissionGuard.

INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN (
  'patient.view','patient.create','patient.edit','appointment.view','appointment.create',
  'appointment.edit','appointment.cancel','course.view','course.use','course.transfer',
  'checkout.create','transaction.view','report.view','commission.view.own'
)
WHERE r.code = 'RECEPTIONIST' AND p.active = true
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN (
  'transaction.view','transaction.void','report.view','report.view.all',
  'commission.view.all','commission.view.own','checkout.create'
)
WHERE r.code = 'FINANCE' AND p.active = true
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN (
  'report.view','report.view.all','commission.view.all','commission.view.own'
)
WHERE r.code = 'REPORT_VIEWER' AND p.active = true
ON CONFLICT DO NOTHING;
