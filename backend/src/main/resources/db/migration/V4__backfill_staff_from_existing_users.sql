INSERT INTO staff (name, name_en, position, phone, email, branch_ids, status, avatar_color, user_id)
SELECT
    u.first_name,
    u.last_name,
    CASE WHEN r.code = 'ADMIN' THEN 'Clinic Manager' ELSE 'Physiotherapist' END,
    '',
    u.email,
    '[]',
    CASE WHEN u.active THEN 'ACTIVE' ELSE 'INACTIVE' END,
    'bg-[#1A4A2E]',
    u.id
FROM users u
JOIN user_roles ur ON ur.user_id = u.id
JOIN roles r ON r.id = ur.role_id
WHERE NOT EXISTS (
    SELECT 1 FROM staff s WHERE s.user_id = u.id
);
