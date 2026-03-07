-- RLS Policies for Kapzo Vendor Panel

-- Enable RLS on all tables (idempotent)
ALTER TABLE vendors          ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalog_items    ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders           ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items      ENABLE ROW LEVEL SECURITY;

-- vendors: own row only
DROP POLICY IF EXISTS "vendors: own row select" ON vendors;
CREATE POLICY "vendors: own row select"
  ON vendors FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "vendors: own row update" ON vendors;
CREATE POLICY "vendors: own row update"
  ON vendors FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- catalog_items: all authenticated users can read
DROP POLICY IF EXISTS "catalog_items: authenticated read" ON catalog_items;
CREATE POLICY "catalog_items: authenticated read"
  ON catalog_items FOR SELECT
  USING (auth.role() = 'authenticated');

-- vendor_inventory: own rows only
DROP POLICY IF EXISTS "vendor_inventory: own rows select" ON vendor_inventory;
CREATE POLICY "vendor_inventory: own rows select"
  ON vendor_inventory FOR SELECT
  USING (
    vendor_id IN (
      SELECT id FROM vendors WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "vendor_inventory: own rows insert" ON vendor_inventory;
CREATE POLICY "vendor_inventory: own rows insert"
  ON vendor_inventory FOR INSERT
  WITH CHECK (
    vendor_id IN (
      SELECT id FROM vendors WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "vendor_inventory: own rows update" ON vendor_inventory;
CREATE POLICY "vendor_inventory: own rows update"
  ON vendor_inventory FOR UPDATE
  USING (
    vendor_id IN (
      SELECT id FROM vendors WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    vendor_id IN (
      SELECT id FROM vendors WHERE user_id = auth.uid()
    )
  );

-- orders: vendor can select and update own orders
DROP POLICY IF EXISTS "orders: vendor select own" ON orders;
CREATE POLICY "orders: vendor select own"
  ON orders FOR SELECT
  USING (
    vendor_id IN (
      SELECT id FROM vendors WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "orders: vendor update own" ON orders;
CREATE POLICY "orders: vendor update own"
  ON orders FOR UPDATE
  USING (
    vendor_id IN (
      SELECT id FROM vendors WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    vendor_id IN (
      SELECT id FROM vendors WHERE user_id = auth.uid()
    )
  );

-- order_items: read for own orders
DROP POLICY IF EXISTS "order_items: vendor select own" ON order_items;
CREATE POLICY "order_items: vendor select own"
  ON order_items FOR SELECT
  USING (
    order_id IN (
      SELECT o.id FROM orders o
      JOIN vendors v ON v.id = o.vendor_id
      WHERE v.user_id = auth.uid()
    )
  );

-- notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications: vendor read own" ON notifications;
CREATE POLICY "notifications: vendor read own"
  ON notifications FOR SELECT
  USING (
    recipient_id::text = auth.uid()::text
    OR recipient_role = 'vendor'
  );

DROP POLICY IF EXISTS "notifications: vendor mark read" ON notifications;
CREATE POLICY "notifications: vendor mark read"
  ON notifications FOR UPDATE
  USING (recipient_id::text = auth.uid()::text)
  WITH CHECK (recipient_id::text = auth.uid()::text);
