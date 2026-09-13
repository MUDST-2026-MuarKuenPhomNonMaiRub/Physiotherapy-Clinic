-- Keep built-in accounts working while authorization moves to permission authorities.
INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.code = 'ADMIN' AND p.active = true
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN (
  'patient.view','patient.create','patient.edit','appointment.view','appointment.create',
  'appointment.edit','appointment.cancel','checkout.create','course.view','course.use',
  'course.transfer','transaction.view','report.view','commission.view.own'
)
WHERE r.code = 'PHYSIO' AND p.active = true
ON CONFLICT DO NOTHING;
