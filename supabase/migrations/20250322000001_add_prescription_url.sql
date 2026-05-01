-- Add prescription_url to orders table
-- Stores the Storage path / public URL of the customer's uploaded prescription image.
-- NULL when no prescription was attached (OTC orders).

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS prescription_url TEXT DEFAULT NULL;

COMMENT ON COLUMN orders.prescription_url IS
  'Storage path or public URL of the prescription image uploaded by the customer. NULL for OTC orders.';
