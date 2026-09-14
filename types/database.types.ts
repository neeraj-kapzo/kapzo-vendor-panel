/**
 * Domain types for the vendor panel UI.
 *
 * These keep the snake_case / lowercase-status shapes the UI was built
 * against. All data now comes from the kapzo-backend REST API (camelCase,
 * UPPERCASE enums) and is converted into these shapes by `lib/api/mappers.ts`
 * — UI components never see backend-native rows.
 */

export type VendorStatus = 'pending' | 'active' | 'banned'

// PAYMENT_PENDING exists on the backend but never reaches the vendor panel —
// orders enter the vendor queue only once payment is confirmed.
export type OrderStatus =
  | 'pending'
  | 'accepted'
  | 'packing'
  | 'packed'
  | 'dispatched'
  | 'delivered'
  | 'rejected'
  | 'cancelled'

export interface Vendor {
  id: string
  user_id: string
  pharmacy_name: string
  email: string
  phone: string
  alt_phone: string | null
  /** Signed read URL, valid ~15 min. Null when no document is on file. */
  license_url: string | null
  fssai_url: string | null
  license_number?: string
  contact_person: string
  address: string
  bank_account_holder: string | null
  bank_name: string | null
  bank_account_number: string | null
  bank_ifsc: string | null
  working_hours_start: string | null
  working_hours_end: string | null
  working_days: string[] | null
  status: VendorStatus
  is_online: boolean
  created_at: string
  /** Snapshot of the platform commission % set by Kapzo admin. */
  commission_percent?: number
  /** GCS object key of the uploaded license (not a browsable URL). */
  license_file_key?: string | null
  /** Map pin; null until the vendor (or Kapzo support) sets it. */
  lat: number | null
  lng: number | null
}

export interface CatalogItem {
  id: string
  name: string
  salt_name: string | null
  image_url: string | null
  mrp: number
  created_by_admin: boolean
  manufacturer?: string
  category?: string
  requires_prescription?: boolean
}

export interface VendorInventory {
  id: string
  vendor_id: string
  catalog_item_id: string
  is_available: boolean
  stock_qty: number
  vendor_price: number
}

export interface Order {
  id: string
  vendor_id: string
  customer_id: string
  rider_id: string | null
  status: OrderStatus
  total_amount: number
  created_at: string
  updated_at: string
  rejection_reason: string | null
  prescription_verified: boolean
  prescription_url: string | null
  /** Human-friendly number, e.g. KPZ-2026-000123 (absent for demo orders). */
  order_number?: string | null
  customer_name?: string | null
  address_line?: string | null
  subtotal?: number | null
  delivery_fee?: number | null
  platform_fee?: number | null
  commission_amount?: number | null
  /** Server-side acceptance deadline (ISO); countdowns derive from this. */
  expires_at?: string | null
  /** Seconds remaining at fetch time, computed on the server clock. */
  seconds_left?: number | null
}

export interface OrderItem {
  id: string
  order_id: string
  catalog_item_id: string
  quantity: number
  unit_price: number
}

export interface Notification {
  id: string
  type: string
  title: string
  message: string
  data: Record<string, unknown> | null
  is_read: boolean
  created_at: string
}

/* ─── Joined / extended types ─── */
export type OrderWithItems = Order & {
  order_items: (OrderItem & { catalog_item: CatalogItem })[]
}

export type InventoryWithCatalog = VendorInventory & {
  catalog_item: CatalogItem
}
