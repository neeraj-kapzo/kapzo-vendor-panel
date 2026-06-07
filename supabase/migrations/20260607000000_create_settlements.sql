CREATE TABLE settlements (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id       UUID          NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  amount          NUMERIC(10,2) NOT NULL,
  status          TEXT          NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  period_start    TIMESTAMPTZ   NOT NULL,
  period_end      TIMESTAMPTZ   NOT NULL,
  settled_at      TIMESTAMPTZ,
  transaction_ref TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

ALTER TABLE settlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vendors see own settlements"
  ON settlements FOR SELECT
  USING (vendor_id = auth.uid());

CREATE POLICY "Vendors insert own settlements"
  ON settlements FOR INSERT
  WITH CHECK (vendor_id = auth.uid());
