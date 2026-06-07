-- Add extended profile fields to vendors table
-- Covers: alternative contact, bank details, working hours, FSSAI document

ALTER TABLE vendors
  ADD COLUMN IF NOT EXISTS alt_phone              TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS bank_account_holder    TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS bank_name              TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS bank_account_number    TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS bank_ifsc              TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS working_hours_start    TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS working_hours_end      TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS working_days           TEXT[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS fssai_url              TEXT DEFAULT NULL;

COMMENT ON COLUMN vendors.alt_phone           IS 'Secondary contact phone number for the pharmacy.';
COMMENT ON COLUMN vendors.bank_account_holder IS 'Name as on the bank account.';
COMMENT ON COLUMN vendors.bank_name           IS 'Bank name (e.g. State Bank of India).';
COMMENT ON COLUMN vendors.bank_account_number IS 'Bank account number (stored as text to preserve leading zeros).';
COMMENT ON COLUMN vendors.bank_ifsc           IS 'IFSC code of the bank branch.';
COMMENT ON COLUMN vendors.working_hours_start IS 'Daily opening time in HH:MM 24h format.';
COMMENT ON COLUMN vendors.working_hours_end   IS 'Daily closing time in HH:MM 24h format.';
COMMENT ON COLUMN vendors.working_days        IS 'Array of working day abbreviations, e.g. {Mon,Tue,Wed}.';
COMMENT ON COLUMN vendors.fssai_url           IS 'Storage path of the FSSAI certificate in the vendor-licenses bucket.';
