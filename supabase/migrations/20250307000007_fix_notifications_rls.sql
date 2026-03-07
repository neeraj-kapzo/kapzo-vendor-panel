-- Fix notifications RLS: recipient_id is uuid in DB, cast both sides to text
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
