-- ============================================================
-- Kapzo Vendor Panel — Initial Schema
-- ============================================================

-- ─── Enums ───────────────────────────────────────────────────
create type vendor_status as enum ('pending', 'active', 'banned');

create type order_status as enum (
  'pending',
  'accepted',
  'packing',
  'packed',
  'dispatched',
  'delivered',
  'rejected',
  'cancelled'
);

-- ─── vendors ─────────────────────────────────────────────────
-- One row per pharmacy. Linked to a Supabase auth user via user_id.
create table vendors (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  pharmacy_name    text not null,
  email            text not null,
  phone            text not null,
  license_url      text,
  contact_person   text not null,
  address          text not null,
  status           vendor_status not null default 'pending',
  is_online        boolean not null default false,
  created_at       timestamptz not null default now(),

  constraint vendors_user_id_key unique (user_id),
  constraint vendors_email_key  unique (email)
);

-- ─── catalog_items ───────────────────────────────────────────
-- Master medicine catalogue managed by admin.
create table catalog_items (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  salt_name         text,
  image_url         text,
  mrp               numeric(10, 2) not null check (mrp >= 0),
  created_by_admin  boolean not null default true
);

-- ─── vendor_inventory ────────────────────────────────────────
-- Each vendor's per-item stock, price, and availability.
create table vendor_inventory (
  id               uuid primary key default gen_random_uuid(),
  vendor_id        uuid not null references vendors (id) on delete cascade,
  catalog_item_id  uuid not null references catalog_items (id) on delete cascade,
  is_available     boolean not null default true,
  stock_qty        integer not null default 0 check (stock_qty >= 0),
  vendor_price     numeric(10, 2) not null check (vendor_price >= 0),

  constraint vendor_inventory_unique unique (vendor_id, catalog_item_id)
);

-- ─── orders ──────────────────────────────────────────────────
-- One row per customer order placed with a vendor.
create table orders (
  id                     uuid primary key default gen_random_uuid(),
  vendor_id              uuid not null references vendors (id) on delete restrict,
  customer_id            uuid not null references auth.users (id) on delete restrict,
  rider_id               uuid references auth.users (id) on delete set null,
  status                 order_status not null default 'pending',
  total_amount           numeric(10, 2) not null check (total_amount >= 0),
  rejection_reason       text,
  prescription_verified  boolean not null default false,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

-- ─── order_items ─────────────────────────────────────────────
-- Line items within an order.
create table order_items (
  id               uuid primary key default gen_random_uuid(),
  order_id         uuid not null references orders (id) on delete cascade,
  catalog_item_id  uuid not null references catalog_items (id) on delete restrict,
  quantity         integer not null check (quantity > 0),
  unit_price       numeric(10, 2) not null check (unit_price >= 0)
);

-- ============================================================
-- Indexes
-- ============================================================

create index idx_vendors_user_id          on vendors (user_id);
create index idx_vendors_status           on vendors (status);

create index idx_catalog_items_name       on catalog_items (name);

create index idx_vendor_inventory_vendor  on vendor_inventory (vendor_id);
create index idx_vendor_inventory_item    on vendor_inventory (catalog_item_id);

create index idx_orders_vendor_id         on orders (vendor_id);
create index idx_orders_customer_id       on orders (customer_id);
create index idx_orders_status            on orders (status);
create index idx_orders_created_at        on orders (created_at desc);

create index idx_order_items_order_id     on order_items (order_id);
create index idx_order_items_catalog_item on order_items (catalog_item_id);

-- ============================================================
-- Auto-update updated_at on orders
-- ============================================================

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger orders_set_updated_at
  before update on orders
  for each row execute function set_updated_at();

-- ============================================================
-- Row Level Security
-- ============================================================

alter table vendors          enable row level security;
alter table catalog_items    enable row level security;
alter table vendor_inventory enable row level security;
alter table orders           enable row level security;
alter table order_items      enable row level security;

-- ─── Helper: get the vendor id for the current auth user ─────
create or replace function get_my_vendor_id()
returns uuid language sql security definer stable as $$
  select id from vendors where user_id = auth.uid() limit 1;
$$;

-- ─── vendors policies ────────────────────────────────────────

-- Vendors can read their own row
create policy "vendor: select own"
  on vendors for select
  using (user_id = auth.uid());

-- Vendors can update their own row (but not status — that's admin-only)
create policy "vendor: update own"
  on vendors for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ─── catalog_items policies ──────────────────────────────────

-- All authenticated users can read the catalogue
create policy "catalog_items: select authenticated"
  on catalog_items for select
  using (auth.role() = 'authenticated');

-- ─── vendor_inventory policies ───────────────────────────────

-- Vendors can read their own inventory
create policy "vendor_inventory: select own"
  on vendor_inventory for select
  using (vendor_id = get_my_vendor_id());

-- Vendors can insert into their own inventory
create policy "vendor_inventory: insert own"
  on vendor_inventory for insert
  with check (vendor_id = get_my_vendor_id());

-- Vendors can update their own inventory
create policy "vendor_inventory: update own"
  on vendor_inventory for update
  using (vendor_id = get_my_vendor_id())
  with check (vendor_id = get_my_vendor_id());

-- ─── orders policies ─────────────────────────────────────────

-- Vendors can read orders assigned to them
create policy "orders: select own vendor"
  on orders for select
  using (vendor_id = get_my_vendor_id());

-- Vendors can update status/rejection_reason on their orders
create policy "orders: update own vendor"
  on orders for update
  using (vendor_id = get_my_vendor_id())
  with check (vendor_id = get_my_vendor_id());

-- ─── order_items policies ────────────────────────────────────

-- Vendors can read items belonging to their orders
create policy "order_items: select own vendor"
  on order_items for select
  using (
    order_id in (
      select id from orders where vendor_id = get_my_vendor_id()
    )
  );
