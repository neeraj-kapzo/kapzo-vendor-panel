-- ============================================================
-- Kapzo — Notifications table + Storage bucket
-- ============================================================

-- ─── Notifications table ─────────────────────────────────────
create table notifications (
  id              uuid primary key default gen_random_uuid(),
  type            text not null,                -- e.g. 'vendor_onboarded', 'order_new'
  title           text not null,
  message         text not null,
  data            jsonb,                        -- arbitrary payload
  recipient_role  text not null default 'admin',-- 'admin' | 'vendor'
  recipient_id    uuid,                         -- null = broadcast to all of that role
  is_read         boolean not null default false,
  created_at      timestamptz not null default now()
);

create index idx_notifications_role       on notifications (recipient_role);
create index idx_notifications_recipient  on notifications (recipient_id);
create index idx_notifications_created    on notifications (created_at desc);
create index idx_notifications_is_read    on notifications (is_read);

-- RLS
alter table notifications enable row level security;

-- Admin can see all notifications (use service role key server-side for admin panel)
-- Vendors can see only notifications addressed to them
create policy "notifications: vendor select own"
  on notifications for select
  using (
    recipient_role = 'vendor'
    and recipient_id = (select id from vendors where user_id = auth.uid() limit 1)
  );

-- Allow authenticated users (vendors) to insert notifications
-- (used during onboarding to ping admin)
create policy "notifications: insert authenticated"
  on notifications for insert
  with check (auth.role() = 'authenticated');

-- ─── Storage bucket: vendor-licenses ─────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'vendor-licenses',
  'vendor-licenses',
  false,                          -- private bucket (use signed URLs)
  10485760,                       -- 10 MB limit
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- Storage RLS: vendors can upload to their own folder (user_id/*)
create policy "vendor-licenses: vendor upload"
  on storage.objects for insert
  with check (
    bucket_id = 'vendor-licenses'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "vendor-licenses: vendor read own"
  on storage.objects for select
  using (
    bucket_id = 'vendor-licenses'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Service role (admin) can read all license files
create policy "vendor-licenses: service role full access"
  on storage.objects
  using (bucket_id = 'vendor-licenses' and auth.role() = 'service_role')
  with check (bucket_id = 'vendor-licenses' and auth.role() = 'service_role');
