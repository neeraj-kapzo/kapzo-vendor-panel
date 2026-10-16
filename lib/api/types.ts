/**
 * Backend-native response shapes (kapzo-backend, camelCase / UPPERCASE
 * enums). Prisma Decimal columns serialise to JSON strings — typed
 * `string | number` here and normalised with Number() in mappers.
 */

export type BackendOrderStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'PACKING'
  | 'PACKED'
  | 'DISPATCHED'
  | 'DELIVERED'
  | 'REJECTED'
  | 'CANCELLED'

export type BackendVerificationStatus = 'PENDING' | 'ACTIVE' | 'BANNED'

/** Confirm-then-pay: how the customer will pay, chosen after the vendor accepts. */
export type BackendPaymentMode = 'UNSET' | 'ONLINE' | 'COD'
/** Whether the order's money has arrived. */
export type BackendOrderPayment = 'UNPAID' | 'PAID' | 'REFUNDED'

export interface BackendUser {
  id: string
  firebaseUid: string
  role: string
  phone: string | null
  email: string | null
  name: string | null
  avatarUrl: string | null
  status: 'ACTIVE' | 'BANNED'
}

/**
 * `GET`/`PATCH /vendors/me`. The Vendor row plus the four things the backend
 * joins on for the profile page: the owner's name and email (they live on the
 * User row) and signed read URLs for the two documents (the `*FileKey` fields
 * are GCS object keys, not links).
 */
export interface BackendVendor {
  id: string
  userId: string
  pharmacyName: string
  licenseNumber: string
  /**
   * Null for a vendor the admin bulk-imported from a CSV: the licence number
   * is on record but the scan is still to be attached, which is also why such
   * a vendor is PENDING rather than active.
   */
  licenseFileKey: string | null
  contactPhone: string
  addressLine: string
  /**
   * The pharmacy's map pin. Null until someone drops a marker — it is never
   * derived from `addressLine`, and Kapzo cannot approve the pharmacy without
   * it, because riders are routed to this point.
   */
  lat: number | null
  lng: number | null
  verificationStatus: BackendVerificationStatus
  isOnline: boolean
  commissionPercent: string | number
  altPhone: string | null
  bankAccountHolder: string | null
  bankName: string | null
  bankAccountNumber: string | null
  bankIfsc: string | null
  /** Short English day labels in calendar order, e.g. ["Mon","Tue"]. */
  workingDays: string[]
  /** "HH:mm", 24-hour. */
  workingHoursStart: string | null
  workingHoursEnd: string | null
  fssaiFileKey: string | null
  contactPerson: string | null
  email: string | null
  licenseUrl: string | null
  fssaiUrl: string | null
  /** Delivery zone the pin falls in; null while the pin is outside every zone. */
  zoneId?: string | null
  zoneName?: string | null
}

export interface BackendOrderItem {
  id: string
  orderId: string
  catalogItemId: string
  name: string
  price: string | number
  quantity: number
}

/** Row shape of GET /vendor/orders and the transition endpoints' echo. */
export interface BackendVendorOrder {
  id: string
  orderNumber: string
  status: BackendOrderStatus
  addressLine: string
  subtotal: string | number
  deliveryFee: string | number
  platformFee: string | number
  total: string | number
  commissionPercent: string | number
  commissionAmount: string | number
  rejectionReason: string | null
  expiresAt: string | null
  createdAt: string
  items: BackendOrderItem[]
  customerName?: string | null
  secondsLeft?: number | null
  /** Admin-simulated order (training). Real alert + state machine; never paid out. */
  isSimulated?: boolean
  paymentMode: BackendPaymentMode
  paymentStatus: BackendOrderPayment
}

export interface BackendVendorOrderPage {
  items: BackendVendorOrder[]
  total: number
}

export interface BackendVendorStatsTotals {
  deliveredCount: number
  grossSales: number
  commission: number
  earnings: number
}

/** Top-level totals are real orders only; `simulated` is the same maths over simulated orders. */
export interface BackendVendorStats extends BackendVendorStatsTotals {
  simulated?: BackendVendorStatsTotals
}

export interface BackendOrderHistoryRow {
  id: string
  orderNumber: string
  status: BackendOrderStatus
  customerName?: string | null
  isSimulated?: boolean
  items?: { name: string; price: number; quantity: number }[]
  subtotal: number
  deliveryFee?: number
  platformFee?: number
  total: number
  commissionPercent?: number
  commission?: number
  earning: number
  rejectionReason?: string | null
  createdAt: string
  deliveredAt?: string | null
}

export interface BackendOrderHistoryPage {
  items: BackendOrderHistoryRow[]
  total: number
}

export interface BackendCatalogItem {
  id: string
  name: string
  saltComposition: string
  /** Null on a few hundred imported OTC/FMCG rows whose source names no
   * marketing company. Admin-entered items always carry one. */
  manufacturer: string | null
  /** e.g. "Strip of 10 tablets"; null where the source had none. */
  packSize: string | null
  mrp: string | number
  imageUrl: string | null
  requiresPrescription: boolean
  category: string
  isActive: boolean
}

export interface BackendInventoryRow {
  catalogItem: BackendCatalogItem
  isAvailable: boolean
  price: string | null
}

export interface BackendInventoryPage {
  items: BackendInventoryRow[]
  total: number
  /** True when `total` stopped counting at its cap — show "1,000+". */
  totalCapped?: boolean
  /** Last page the API serves; deeper pages are refused. */
  maxPage?: number
}

/** Which column(s) the inventory search box looks in. */
export type CatalogScope = 'all' | 'name' | 'composition' | 'manufacturer'

/** "relevance" = best match first (A-Z when there is no search text). */
export type CatalogSortKey = 'relevance' | 'name' | 'priceAsc' | 'priceDesc'

/** Everything the Inventory page sends to `GET /vendors/me/inventory`. */
export interface InventoryQuery {
  q?: string
  page?: number
  scope?: CatalogScope
  /** true = prescription only, false = OTC; omit for both. */
  requiresPrescription?: boolean
  sort?: CatalogSortKey
}

export interface BackendVendorInventory {
  id: string
  vendorId: string
  catalogItemId: string
  isAvailable: boolean
  price: string | number
}

export interface BackendNotification {
  id: string
  userId: string
  type: string
  title: string
  body: string
  data: Record<string, unknown> | null
  readAt: string | null
  createdAt: string
}

export type StatsRange = 'today' | 'week' | 'month'

/** Socket.IO event payloads (vendor room). */
export interface NewOrderEvent {
  orderId: string
  orderNumber: string
  expiresAt: string | null
  total: string | number
  /** Always UNSET at this point — the customer chooses after you accept. */
  paymentMode?: BackendPaymentMode
  isSimulated?: boolean
}

export interface OrderStatusEvent {
  orderId: string
  status: BackendOrderStatus
  isSimulated?: boolean
}

export interface SimulationResetEvent {
  vendorId: string
}

/** One practice withdrawal of simulated earnings (never paid out). */
export interface BackendSimulatedSettlement {
  id: string
  amount: number
  createdAt: string
}

/** `GET /vendor/simulated-settlements` — simulated earnings not yet practice-withdrawn, plus history. */
export interface BackendSimulatedSettlements {
  available: number
  items: BackendSimulatedSettlement[]
}
