-- V5 already owns these tables; this migration only completes the catalogue.
ALTER TABLE permissions ALTER COLUMN module SET DEFAULT 'GENERAL';
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
