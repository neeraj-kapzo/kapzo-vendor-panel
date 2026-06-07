/**
 * Demo Mode — all mock data and helpers.
 *
 * Enable by setting NEXT_PUBLIC_DEMO_MODE=true in your environment.
 * When active the entire Supabase dependency is bypassed; all pages
 * render with the data exported from this file.
 */

import type { Vendor, Order, OrderStatus } from '@/types/database.types'
import type { Database } from '@/types/database.types'

type OrderItem   = Database['public']['Tables']['order_items']['Row']
type CatalogItem = Database['public']['Tables']['catalog_items']['Row']

/* ── Structural equivalents (no client-component import needed) ────── */

export type DemoOrderWithItems = Order & {
  order_items: (OrderItem & { catalog_item: CatalogItem })[]
}

export type DemoMergedInventoryItem = {
  catalog_id:   string
  name:         string
  salt_name:    string | null
  image_url:    string | null
  mrp:          number
  inv_id:       string | null
  vendor_price: number
  stock_qty:    number
  is_available: boolean
}

export type DemoHistoryOrderItem = {
  quantity:     number
  unit_price:   number
  catalog_item: { name: string }
}

export type DemoHistoryOrder = {
  id:                    string
  status:                OrderStatus
  total_amount:          number
  created_at:            string
  updated_at:            string
  rejection_reason:      string | null
  prescription_verified: boolean
  order_items:           DemoHistoryOrderItem[]
}

/* ─────────────────────────────────────────────────────────────────── */

export const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

export const DEMO_VENDOR_ID = 'demo-vendor-001'

export const DEMO_VENDOR: Vendor = {
  id:                   DEMO_VENDOR_ID,
  user_id:              'demo-user-001',
  pharmacy_name:        'Kapzo Demo Pharmacy',
  contact_person:       'Arjun Sharma',
  phone:                '9876543210',
  alt_phone:            '9123456789',
  email:                'demo@kapzo.in',
  address:              '42, Linking Road, Bandra West, Mumbai 400050',
  status:               'active',
  is_online:            true,
  license_url:          null,
  fssai_url:            null,
  bank_account_holder:  'Arjun Sharma',
  bank_name:            'State Bank of India',
  bank_account_number:  '30987654321',
  bank_ifsc:            'SBIN0001234',
  working_hours_start:  '09:00',
  working_hours_end:    '21:00',
  working_days:         ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  created_at:           '2025-01-15T00:00:00.000Z',
}

/* ── Catalog ─────────────────────────────────────────────────────── */

const DEMO_CATALOG: CatalogItem[] = [
  { id: 'cat-01', name: 'Paracetamol 500mg',   salt_name: 'Paracetamol',            mrp:  25.00, image_url: null, created_by_admin: true },
  { id: 'cat-02', name: 'Amoxicillin 250mg',   salt_name: 'Amoxicillin Trihydrate', mrp:  85.00, image_url: null, created_by_admin: true },
  { id: 'cat-03', name: 'Azithromycin 500mg',  salt_name: 'Azithromycin',           mrp: 140.00, image_url: null, created_by_admin: true },
  { id: 'cat-04', name: 'Metformin 500mg',     salt_name: 'Metformin HCl',          mrp:  35.00, image_url: null, created_by_admin: true },
  { id: 'cat-05', name: 'Atorvastatin 10mg',   salt_name: 'Atorvastatin',           mrp: 120.00, image_url: null, created_by_admin: true },
  { id: 'cat-06', name: 'Omeprazole 20mg',     salt_name: 'Omeprazole',             mrp:  45.00, image_url: null, created_by_admin: true },
  { id: 'cat-07', name: 'Cetirizine 10mg',     salt_name: 'Cetirizine HCl',         mrp:  30.00, image_url: null, created_by_admin: true },
  { id: 'cat-08', name: 'Ibuprofen 400mg',     salt_name: 'Ibuprofen',              mrp:  55.00, image_url: null, created_by_admin: true },
  { id: 'cat-09', name: 'Pantoprazole 40mg',   salt_name: 'Pantoprazole',           mrp:  65.00, image_url: null, created_by_admin: true },
  { id: 'cat-10', name: 'Dolo 650mg',          salt_name: 'Paracetamol',            mrp:  30.00, image_url: null, created_by_admin: true },
  { id: 'cat-11', name: 'Vitamin D3 60000IU',  salt_name: 'Cholecalciferol',        mrp: 180.00, image_url: null, created_by_admin: true },
  { id: 'cat-12', name: 'Multivitamin Tablets',salt_name: 'Vitamins & Minerals',    mrp: 220.00, image_url: null, created_by_admin: true },
]

/* ── Inventory ───────────────────────────────────────────────────── */

export const DEMO_INVENTORY: DemoMergedInventoryItem[] = DEMO_CATALOG.map((c, i) => ({
  catalog_id:   c.id,
  name:         c.name,
  salt_name:    c.salt_name,
  image_url:    c.image_url,
  mrp:          c.mrp,
  inv_id:       `inv-${String(i + 1).padStart(2, '0')}`,
  // 10 % below MRP, rounded to nearest 0.50
  vendor_price: Math.round(c.mrp * 0.9 * 2) / 2,
  stock_qty:    [50, 30, 20, 100, 45, 60, 80, 35, 25, 90, 15, 40][i],
  // cat-04 (Metformin) and cat-11 (Vit D3) shown as unavailable for demo variety
  is_available: i !== 3 && i !== 10,
}))

/* ── Helpers ─────────────────────────────────────────────────────── */

function buildItems(
  pairs: { catId: string; qty: number }[]
): DemoOrderWithItems['order_items'] {
  return pairs.map(({ catId, qty }) => {
    const cat = DEMO_CATALOG.find((c) => c.id === catId)!
    const inv = DEMO_INVENTORY.find((i) => i.catalog_id === catId)!
    return {
      id:              `item-${catId}`,
      order_id:        '',          // caller overwrites
      catalog_item_id: catId,
      quantity:        qty,
      unit_price:      inv.vendor_price,
      catalog_item:    cat,
    }
  })
}

const DEMO_PRESCRIPTION_URL = '/demo/prescription.svg'

function makeOrder(
  id:        string,
  status:    OrderStatus,
  createdAt: Date,
  pairs:     { catId: string; qty: number }[],
  opts?:     { rejection_reason?: string; prescription_verified?: boolean; updatedOffset?: number }
): DemoOrderWithItems {
  const items       = buildItems(pairs).map((i) => ({ ...i, order_id: id }))
  const totalAmount = items.reduce((s, i) => s + i.unit_price * i.quantity, 0)
  const updatedAt   = opts?.updatedOffset
    ? new Date(createdAt.getTime() + opts.updatedOffset).toISOString()
    : createdAt.toISOString()
  const hasPrescription = opts?.prescription_verified ?? false

  return {
    id,
    vendor_id:             DEMO_VENDOR_ID,
    customer_id:           'demo-cust-001',
    rider_id:              null,
    status,
    total_amount:          totalAmount,
    created_at:            createdAt.toISOString(),
    updated_at:            updatedAt,
    rejection_reason:      opts?.rejection_reason ?? null,
    prescription_verified: hasPrescription,
    prescription_url:      hasPrescription ? DEMO_PRESCRIPTION_URL : null,
    order_items:           items,
  }
}

/* ── Active orders — timestamps relative to now (timers work) ───── */

export function getDemoActiveOrders(): DemoOrderWithItems[] {
  const now = Date.now()
  return [
    // Pending — created 30 s ago → ~90 s left on the 2-min timer
    makeOrder('demo-pend-1', 'pending',
      new Date(now - 30_000),
      [{ catId: 'cat-01', qty: 2 }, { catId: 'cat-07', qty: 1 }],
      { prescription_verified: true }
    ),
    makeOrder('demo-acc-1', 'accepted',
      new Date(now - 25 * 60_000),
      [{ catId: 'cat-02', qty: 1 }, { catId: 'cat-06', qty: 2 }],
      { prescription_verified: true }
    ),
    makeOrder('demo-acc-2', 'accepted',
      new Date(now - 18 * 60_000),
      [{ catId: 'cat-03', qty: 1 }, { catId: 'cat-08', qty: 1 }, { catId: 'cat-10', qty: 3 }],
    ),
    makeOrder('demo-pack-1', 'packing',
      new Date(now - 12 * 60_000),
      [{ catId: 'cat-05', qty: 1 }, { catId: 'cat-09', qty: 1 }],
    ),
    makeOrder('demo-packed-1', 'packed',
      new Date(now - 35 * 60_000),
      [{ catId: 'cat-04', qty: 3 }, { catId: 'cat-06', qty: 2 }],
    ),
    makeOrder('demo-disp-1', 'dispatched',
      new Date(now - 50 * 60_000),
      [{ catId: 'cat-11', qty: 1 }, { catId: 'cat-12', qty: 1 }],
      { prescription_verified: true }
    ),
  ]
}

/* ── Closed orders for the Orders page tabs ─────────────────────── */

export function getDemoClosedOrders(): Order[] {
  const now = Date.now()
  return [
    makeOrder('demo-del-1', 'delivered', new Date(now - 60 * 60_000),
      [{ catId: 'cat-01', qty: 2 }, { catId: 'cat-07', qty: 1 }],
      { updatedOffset: 15 * 60_000 }
    ),
    makeOrder('demo-del-2', 'delivered', new Date(now - 2 * 60 * 60_000),
      [{ catId: 'cat-02', qty: 1 }, { catId: 'cat-09', qty: 2 }],
      { prescription_verified: true, updatedOffset: 20 * 60_000 }
    ),
    makeOrder('demo-del-3', 'delivered', new Date(now - 3 * 60 * 60_000),
      [{ catId: 'cat-08', qty: 2 }],
      { updatedOffset: 25 * 60_000 }
    ),
    makeOrder('demo-rej-1', 'rejected', new Date(now - 45 * 60_000),
      [{ catId: 'cat-04', qty: 1 }],
      { rejection_reason: 'Medicine Out of Stock', updatedOffset: 2 * 60_000 }
    ),
    makeOrder('demo-rej-2', 'rejected', new Date(now - 150 * 60_000),
      [{ catId: 'cat-03', qty: 1 }],
      { rejection_reason: 'Pharmacy Closing Soon', updatedOffset: 3 * 60_000 }
    ),
    makeOrder('demo-can-1', 'cancelled', new Date(now - 90 * 60_000),
      [{ catId: 'cat-06', qty: 1 }],
      { updatedOffset: 5 * 60_000 }
    ),
  ]
}

/* ── Dashboard stats ─────────────────────────────────────────────── */

export function getDemoStats() {
  // Today: 6 active + 3 delivered = 9 total; revenue from delivered orders
  const activeOrders  = getDemoActiveOrders()
  const closedToday   = getDemoClosedOrders().filter((o) => o.status === 'delivered')
  const todayCount    = activeOrders.length + closedToday.length
  const todayRevenue  = closedToday.reduce((s, o) => s + o.total_amount, 0)
  const pendingCount  = activeOrders.filter((o) => o.status === 'pending').length
  return { todayCount, todayRevenue, pendingCount, acceptanceRate: 92 }
}

/* ── History orders — one per day for last 30 days ──────────────── */

const HISTORY_ITEM_SETS: DemoHistoryOrderItem[][] = [
  [{ quantity: 2, unit_price: 22.50, catalog_item: { name: 'Paracetamol 500mg' } }],
  [{ quantity: 1, unit_price: 76.50, catalog_item: { name: 'Amoxicillin 250mg' } }, { quantity: 2, unit_price: 40.50, catalog_item: { name: 'Omeprazole 20mg' } }],
  [{ quantity: 1, unit_price: 126.00, catalog_item: { name: 'Azithromycin 500mg' } }],
  [{ quantity: 3, unit_price: 27.00, catalog_item: { name: 'Dolo 650mg' } }, { quantity: 1, unit_price: 27.00, catalog_item: { name: 'Cetirizine 10mg' } }],
  [{ quantity: 1, unit_price: 108.00, catalog_item: { name: 'Atorvastatin 10mg' } }, { quantity: 1, unit_price: 58.50, catalog_item: { name: 'Pantoprazole 40mg' } }],
  [{ quantity: 2, unit_price: 49.50, catalog_item: { name: 'Ibuprofen 400mg' } }],
  [{ quantity: 1, unit_price: 162.00, catalog_item: { name: 'Vitamin D3 60000IU' } }, { quantity: 1, unit_price: 198.00, catalog_item: { name: 'Multivitamin Tablets' } }],
  [{ quantity: 3, unit_price: 31.50, catalog_item: { name: 'Metformin 500mg' } }, { quantity: 1, unit_price: 108.00, catalog_item: { name: 'Atorvastatin 10mg' } }],
  [{ quantity: 1, unit_price: 22.50, catalog_item: { name: 'Paracetamol 500mg' } }, { quantity: 1, unit_price: 126.00, catalog_item: { name: 'Azithromycin 500mg' } }],
  [{ quantity: 2, unit_price: 27.00, catalog_item: { name: 'Cetirizine 10mg' } }, { quantity: 1, unit_price: 40.50, catalog_item: { name: 'Omeprazole 20mg' } }],
]

const HISTORY_STATUS_CYCLE: OrderStatus[] = [
  'delivered', 'delivered', 'delivered', 'delivered', 'delivered',
  'rejected', 'rejected',
  'delivered', 'delivered',
  'cancelled',
]

const REJECTION_REASONS = [
  'Medicine Out of Stock',
  'Pharmacy Closing Soon',
  'Cannot Fulfill Quantity',
]

let _cachedHistoryOrders: DemoHistoryOrder[] | null = null

export function getDemoHistoryOrders(): DemoHistoryOrder[] {
  // Memoize — timestamps relative to module load, good enough for a session
  if (_cachedHistoryOrders) return _cachedHistoryOrders

  const now    = new Date()
  const orders: DemoHistoryOrder[] = []

  for (let i = 0; i < 30; i++) {
    const hoursOfDay = 8 + ((i * 3) % 12)      // 8 am – 8 pm
    const minuteOfDay = (i * 17) % 60

    const updatedAt = new Date(
      now.getFullYear(), now.getMonth(), now.getDate() - i,
      hoursOfDay, minuteOfDay, 0, 0
    )
    const createdAt = new Date(updatedAt.getTime() - 15 * 60_000)

    const status  = HISTORY_STATUS_CYCLE[i % HISTORY_STATUS_CYCLE.length]
    const items   = HISTORY_ITEM_SETS[i % HISTORY_ITEM_SETS.length]
    const total   = items.reduce((s, it) => s + it.unit_price * it.quantity, 0)

    orders.push({
      id:                    `hist-${String(i + 1).padStart(3, '0')}`,
      status,
      total_amount:          total,
      created_at:            createdAt.toISOString(),
      updated_at:            updatedAt.toISOString(),
      rejection_reason:      status === 'rejected' ? REJECTION_REASONS[i % REJECTION_REASONS.length] : null,
      prescription_verified: i % 5 === 0,
      order_items:           items,
    })
  }

  _cachedHistoryOrders = orders
  return orders
}

/* ── Simulated order generator (for the "Simulate New Order" button) */

const SIMULATE_ITEM_SETS: { catId: string; qty: number }[][] = [
  [{ catId: 'cat-01', qty: 2 }, { catId: 'cat-07', qty: 1 }],
  [{ catId: 'cat-02', qty: 1 }, { catId: 'cat-08', qty: 2 }],
  [{ catId: 'cat-03', qty: 1 }, { catId: 'cat-06', qty: 1 }, { catId: 'cat-10', qty: 3 }],
  [{ catId: 'cat-09', qty: 2 }],
  [{ catId: 'cat-05', qty: 1 }, { catId: 'cat-04', qty: 2 }],
]

let _simCounter = 0

export function generateDemoSimulatedOrder(): DemoOrderWithItems {
  _simCounter++
  const id              = `demo-sim-${Date.now()}`
  const pairs           = SIMULATE_ITEM_SETS[(_simCounter - 1) % SIMULATE_ITEM_SETS.length]
  const hasPrescription = _simCounter % 3 === 0
  return makeOrder(id, 'pending', new Date(), pairs, {
    prescription_verified: hasPrescription,
  })
}
