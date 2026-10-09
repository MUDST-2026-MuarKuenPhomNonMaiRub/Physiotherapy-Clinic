-- Business policy: commission earned after a staff member's termination date
-- is forfeited unless an administrator explicitly changes that staff record.
ALTER TABLE staff
  ALTER COLUMN commission_after_termination_policy SET DEFAULT 'FORFEIT_AFTER_TERMINATION';

UPDATE staff
SET commission_after_termination_policy = 'FORFEIT_AFTER_TERMINATION'
WHERE commission_after_termination_policy IS NULL
   OR commission_after_termination_policy = 'CONTINUE_UNTIL_COURSE_END';
