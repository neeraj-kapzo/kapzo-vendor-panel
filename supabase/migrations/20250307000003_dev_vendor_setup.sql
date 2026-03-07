-- ============================================================
-- Kapzo — Dev helper: Create a vendor profile for an auth user
-- ============================================================
-- HOW TO USE:
--   1. Create a user in Supabase Auth (Dashboard → Authentication → Users → Add user)
--   2. Copy that user's UUID
--   3. Replace <YOUR_AUTH_USER_UUID> below with the UUID
--   4. Run this in the Supabase SQL Editor
--
-- DO NOT run this migration via supabase db push — it's a one-off dev helper.
-- ============================================================

/*
insert into vendors (
  user_id,
  pharmacy_name,
  email,
  phone,
  contact_person,
  address,
  status,
  is_online
) values (
  '<YOUR_AUTH_USER_UUID>',   -- replace with your auth user UUID
  'Kapzo Demo Pharmacy',
  'demo@kapzo.in',
  '9876543210',
  'Demo Owner',
  '123, MG Road, Bengaluru, Karnataka 560001',
  'active',
  true
);
*/

-- After inserting the vendor, add some inventory from the catalogue:
/*
insert into vendor_inventory (vendor_id, catalog_item_id, is_available, stock_qty, vendor_price)
select
  (select id from vendors where email = 'demo@kapzo.in'),
  id,
  true,
  floor(random() * 100 + 10)::int,
  mrp * 0.9   -- 10% below MRP
from catalog_items;
*/
