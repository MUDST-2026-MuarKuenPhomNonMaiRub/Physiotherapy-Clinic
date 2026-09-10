-- What the patient handed over in cash, and what went back as change.
--
-- Revenue is still the payment amount: the change never belonged to the clinic,
-- so counting the tendered note as income would overstate every cash sale. These
-- two columns exist so the drawer can be reconciled against the receipts, which
-- the amount alone cannot answer.
--
-- Null for every non-cash payment, and for cash receipts taken before this
-- column existed — those were not recorded, and a zero would read as "nothing
-- was handed over" rather than "we do not know".

ALTER TABLE payments
  ADD COLUMN cash_received numeric(14, 2),
  ADD COLUMN change_given  numeric(14, 2);

ALTER TABLE payments
  ADD CONSTRAINT payments_cash_received_covers_amount
    CHECK (cash_received IS NULL OR cash_received >= amount),
  ADD CONSTRAINT payments_change_given_matches_cash
    CHECK (
      (cash_received IS NULL AND change_given IS NULL)
      OR (cash_received IS NOT NULL AND change_given = cash_received - amount)
    );

COMMENT ON COLUMN payments.cash_received IS
  'Cash handed over by the patient. Null unless the method was cash.';
COMMENT ON COLUMN payments.change_given IS
  'cash_received - amount. Null unless the method was cash.';
