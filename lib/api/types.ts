/**
 * Backend-native response shapes (kapzo-backend, camelCase / UPPERCASE
 * enums). Prisma Decimal columns serialise to JSON strings — typed
 * `string | number` here and normalised with Number() in mappers.
 */

export type BackendOrderStatus =
  | 'PAYMENT_PENDING'
  | 'PENDING'
  | 'ACCEPTED'
  | 'PACKING'
  | 'PACKED'
  | 'DISPATCHED'
  | 'DELIVERED'
  | 'REJECTED'
  | 'CANCELLED'

export type BackendVerificationStatus = 'PENDING' | 'ACTIVE' | 'BANNED'

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
}

export interface BackendVendorOrderPage {
  items: BackendVendorOrder[]
  total: number
}

export interface BackendVendorStats {
  deliveredCount: number
  grossSales: number
  commission: number
  earnings: number
}

export interface BackendOrderHistoryRow {
  id: string
  orderNumber: string
  status: BackendOrderStatus
  subtotal: number
  total: number
  earning: number
  createdAt: string
}

export interface BackendOrderHistoryPage {
  items: BackendOrderHistoryRow[]
  total: number
}

export interface BackendCatalogItem {
  id: string
  name: string
  saltComposition: string
  manufacturer: string
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
}

export interface OrderStatusEvent {
  orderId: string
  status: BackendOrderStatus
}
