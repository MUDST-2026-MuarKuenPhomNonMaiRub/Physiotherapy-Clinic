CREATE TABLE permissions (
  id BIGSERIAL PRIMARY KEY,
  code VARCHAR(60) NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL
);
CREATE TABLE role_permissions (
  role_id BIGINT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id BIGINT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);
INSERT INTO permissions(code,name) VALUES
 ('patient.view','View patient records'),('patient.create','Register new patient'),
 ('patient.edit','Edit patient details'),('appointment.view','View appointments'),
 ('appointment.create','Book appointment'),('appointment.edit','Update appointments'),
 ('appointment.cancel','Cancel appointments'),('checkout.create','Create checkout'),
 ('course.view','View course balances'),('course.use','Use course session'),
 ('course.transfer','Transfer course sessions'),('transaction.view','View transactions'),
 ('transaction.void','Void transactions'),('report.view','View reports'),
 ('report.view.all','View all reports'),('dashboard.view','View dashboard'),
 ('commission.view.own','View own commission'),('commission.view.all','View all commission'),
 ('settings.manage','Manage settings') ON CONFLICT (code) DO NOTHING;
