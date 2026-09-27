-- Keep the row so existing payment records retain their foreign-key reference.
UPDATE payment_methods SET active = FALSE WHERE code = 'QR';
