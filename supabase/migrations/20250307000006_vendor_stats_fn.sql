-- get_vendor_stats(p_vendor_id UUID)
-- Returns aggregated stats for the vendor dashboard cards.
-- Single efficient query using conditional aggregation.

CREATE OR REPLACE FUNCTION get_vendor_stats(p_vendor_id UUID)
RETURNS TABLE (
  orders_today      INT,
  pending_count     INT,
  revenue_today     NUMERIC,
  acceptance_rate   NUMERIC
)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  WITH today_orders AS (
    SELECT
      id,
      status,
      total_amount,
      created_at
    FROM orders
    WHERE
      vendor_id   = p_vendor_id
      AND created_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata'
  ),
  stats AS (
    SELECT
      COUNT(*)                                                             AS orders_today,
      COUNT(*) FILTER (WHERE status = 'pending')                           AS pending_count,
      COALESCE(SUM(total_amount) FILTER (WHERE status = 'delivered'), 0)  AS revenue_today,
      CASE
        WHEN COUNT(*) FILTER (WHERE status IN ('delivered', 'rejected', 'cancelled')) = 0 THEN 100
        ELSE ROUND(
          COUNT(*) FILTER (WHERE status = 'delivered')::NUMERIC
          / COUNT(*) FILTER (WHERE status IN ('delivered', 'rejected', 'cancelled'))::NUMERIC
          * 100,
          1
        )
      END AS acceptance_rate
    FROM today_orders
  )
  SELECT
    orders_today::INT,
    pending_count::INT,
    revenue_today::NUMERIC,
    acceptance_rate::NUMERIC
  FROM stats;
$$;

-- Grant execute to authenticated users (vendors call this from the client)
GRANT EXECUTE ON FUNCTION get_vendor_stats(UUID) TO authenticated;

-- NOTE: pg_cron schedule for auto-reject Edge Function.
-- Requires pg_cron + pg_net extensions enabled in the Supabase dashboard.
-- Replace <PROJECT_REF> with your actual project ref, then run manually in SQL editor:
--
-- SELECT cron.schedule(
--   'auto-reject-expired-orders',
--   '*/2 * * * *',
--   $$
--     SELECT net.http_post(
--       url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/auto-reject-orders',
--       headers := jsonb_build_object(
--         'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
--         'Content-Type',  'application/json'
--       ),
--       body    := '{}'::jsonb
--     );
--   $$
-- );
