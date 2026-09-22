/**
 * Typed client for the kapzo-backend REST API (/api/v1).
 * All functions return UI domain shapes (see lib/api/mappers.ts) unless the
 * backend shape is already what the UI consumes (stats, history).
 */
import { getFirebaseAuth } from '@/lib/firebase'
import type { Order, OrderStatus, OrderWithItems, Vendor } from '@/types/database.types'
import { api } from './http'
import { mapVendor, mapVendorOrderPlain, mapVendorOrders } from './mappers'
import type {
  BackendInventoryPage,
  BackendNotification,
  BackendOrderHistoryPage,
  BackendUser,
  BackendVendor,
  BackendVendorInventory,
  BackendVendorOrder,
  BackendVendorOrderPage,
  BackendVendorStats,
  StatsRange,
} from './types'

export { ApiError } from './http'
export * from './types'
export * from './mappers'

/* ─── Auth ─────────────────────────────────────────────────────────── */

/** Verifies the Firebase token server-side and upserts the User row. */
export async function bootstrap(token: string): Promise<BackendUser> {
  return api<BackendUser>('/auth/bootstrap', { method: 'POST', body: {}, token })
}

/* ─── Vendor profile ───────────────────────────────────────────────── */

export async function fetchVendorMe(): Promise<Vendor> {
  const row = await api<BackendVendor>('/vendors/me')
  return mapVendor(row, getFirebaseAuth().currentUser?.email)
}

/**
 * Self-service profile edit. Licence (number + document), FSSAI certificate,
 * bank details, commission, verification status and the contact phone (which
 * is also the Firebase login identity) are admin-owned — the backend's
 * whitelist strips anything else in the payload. Changing the address
 * re-geocodes it server-side, so a vague address comes back as a 400 the
 * caller should surface verbatim. `null` clears a nullable field.
 */
export interface UpdateVendorMeInput {
  pharmacyName?: string
  addressLine?: string
  altPhone?: string | null
  /**
   * The pharmacy's map pin, sent together or not at all (the backend 400s on
   * one without the other). Editing `addressLine` never moves it: the pin is
   * set by dropping a marker, so a typo in the address text can't quietly
   * relocate where riders are sent.
   */
  lat?: number
  lng?: number
  workingDays?: string[]
  /** "HH:mm", 24-hour. */
  workingHoursStart?: string | null
  workingHoursEnd?: string | null
}

export async function updateVendorMe(input: UpdateVendorMeInput): Promise<Vendor> {
  const row = await api<BackendVendor>('/vendors/me', {
    method: 'PATCH',
    body: input,
  })
  return mapVendor(row, getFirebaseAuth().currentUser?.email)
}

export async function setVendorOnline(isOnline: boolean): Promise<Vendor> {
  const row = await api<BackendVendor>('/vendors/me/online', {
    method: 'POST',
    body: { isOnline },
  })
  return mapVendor(row, getFirebaseAuth().currentUser?.email)
}

export interface RegisterVendorInput {
  pharmacyName: string
  licenseNumber: string
  licenseFileKey: string
  contactPhone: string
  addressLine: string
  lat: number
  lng: number
}

export async function registerVendor(input: RegisterVendorInput): Promise<Vendor> {
  const row = await api<BackendVendor>('/vendors/register', {
    method: 'POST',
    body: input,
  })
  return mapVendor(row, getFirebaseAuth().currentUser?.email)
}

/* ─── Orders ───────────────────────────────────────────────────────── */

const ACTIVE_STATUSES: OrderStatus[] = ['pending', 'accepted', 'packing', 'packed', 'dispatched']
const CLOSED_STATUSES: OrderStatus[] = ['delivered', 'rejected', 'cancelled']

async function fetchOrdersByStatus(
  vendorId: string,
  status: OrderStatus,
  page = 1,
): Promise<OrderWithItems[]> {
  const result = await api<BackendVendorOrderPage>('/vendor/orders', {
    query: { status: status.toUpperCase(), page },
  })
  return mapVendorOrders(result.items, vendorId)
}

/**
 * The backend lists one status per call; fan out and merge. Sorted newest
 * first to match the old Supabase `order by created_at desc` feeds.
 */
async function fetchOrdersInStatuses(
  vendorId: string,
  statuses: OrderStatus[],
): Promise<OrderWithItems[]> {
  const pages = await Promise.all(statuses.map((s) => fetchOrdersByStatus(vendorId, s)))
  return pages
    .flat()
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
}

export function fetchActiveOrders(vendorId: string): Promise<OrderWithItems[]> {
  return fetchOrdersInStatuses(vendorId, ACTIVE_STATUSES)
}

export function fetchClosedOrders(vendorId: string): Promise<OrderWithItems[]> {
  return fetchOrdersInStatuses(vendorId, CLOSED_STATUSES)
}

type VendorOrderAction = 'accept' | 'reject' | 'packing' | 'packed' | 'dispatched'

async function transitionOrder(
  vendorId: string,
  orderId: string,
  action: VendorOrderAction,
  body?: { reason: string },
): Promise<Order> {
  const row = await api<BackendVendorOrder>(`/vendor/orders/${orderId}/${action}`, {
    method: 'POST',
    ...(body ? { body } : { body: {} }),
  })
  return mapVendorOrderPlain(row, vendorId)
}

export const acceptOrder = (vendorId: string, orderId: string) =>
  transitionOrder(vendorId, orderId, 'accept')
export const rejectOrder = (vendorId: string, orderId: string, reason: string) =>
  transitionOrder(vendorId, orderId, 'reject', { reason })
export const markOrderPacking = (vendorId: string, orderId: string) =>
  transitionOrder(vendorId, orderId, 'packing')
export const markOrderPacked = (vendorId: string, orderId: string) =>
  transitionOrder(vendorId, orderId, 'packed')
export const markOrderDispatched = (vendorId: string, orderId: string) =>
  transitionOrder(vendorId, orderId, 'dispatched')

export async function fetchOrder(vendorId: string, orderId: string): Promise<OrderWithItems | null> {
  // No single-order GET on the vendor surface; look through active statuses.
  for (const status of ACTIVE_STATUSES) {
    const orders = await fetchOrdersByStatus(vendorId, status)
    const match = orders.find((o) => o.id === orderId)
    if (match) return match
  }
  return null
}

/* ─── Stats & history (V-08) ───────────────────────────────────────── */

export function fetchVendorStats(range: StatsRange = 'today'): Promise<BackendVendorStats> {
  return api<BackendVendorStats>('/vendor/stats', { query: { range } })
}

export function fetchOrderHistory(
  range: StatsRange = 'today',
  page = 1,
): Promise<BackendOrderHistoryPage> {
  return api<BackendOrderHistoryPage>('/vendor/orders/history', { query: { range, page } })
}

export interface DashboardStats {
  todayCount: number
  todayRevenue: number
  pendingCount: number
  acceptanceRate: number
}

/**
 * Dashboard tiles, assembled from the vendor stats + history endpoints.
 * Semantics shift slightly from the old Supabase queries (the backend only
 * aggregates closed orders): today's count = closed today + active created
 * today; revenue = gross sales of orders delivered today; acceptance rate =
 * non-rejected share of the last 7 days' orders.
 */
export async function fetchDashboardStats(
  vendorId: string,
): Promise<DashboardStats & { activeOrders: OrderWithItems[] }> {
  const [statsToday, historyToday, statsWeek, historyWeek, activeOrders] = await Promise.all([
    fetchVendorStats('today'),
    fetchOrderHistory('today', 1),
    fetchVendorStats('week'),
    fetchOrderHistory('week', 1),
    fetchActiveOrders(vendorId),
  ])

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const activeToday = activeOrders.filter((o) => new Date(o.created_at) >= todayStart)

  const total7 = historyWeek.total + activeOrders.length
  // History and active orders include simulated ones; stats' top-level
  // totals are real-only, so add the simulated delivered count back in to
  // keep numerator and denominator over the same set of orders.
  const accepted7 =
    statsWeek.deliveredCount +
    (statsWeek.simulated?.deliveredCount ?? 0) +
    activeOrders.length

  return {
    todayCount: historyToday.total + activeToday.length,
    todayRevenue: statsToday.grossSales,
    pendingCount: activeOrders.filter((o) =>
      ['pending', 'accepted', 'packing'].includes(o.status),
    ).length,
    acceptanceRate: total7 > 0 ? Math.min(100, Math.round((accepted7 / total7) * 100)) : 100,
    activeOrders,
  }
}

/* ─── Inventory ────────────────────────────────────────────────────── */

export function fetchInventory(q?: string, page = 1): Promise<BackendInventoryPage> {
  return api<BackendInventoryPage>('/vendors/me/inventory', { query: { q, page } })
}

export function upsertInventory(
  catalogItemId: string,
  input: { isAvailable: boolean; price: number },
): Promise<BackendVendorInventory> {
  return api<BackendVendorInventory>(`/vendors/me/inventory/${catalogItemId}`, {
    method: 'PUT',
    body: input,
  })
}

/* ─── Notifications ────────────────────────────────────────────────── */

export function fetchNotifications(unreadOnly = false): Promise<BackendNotification[]> {
  return api<BackendNotification[]>('/notifications', {
    query: unreadOnly ? { unread: 'true' } : undefined,
  })
}

export function markNotificationRead(id: string): Promise<BackendNotification> {
  return api<BackendNotification>(`/notifications/${id}/read`, { method: 'POST', body: {} })
}

/* ─── Storage ──────────────────────────────────────────────────────── */

export type UploadPurpose = 'prescription' | 'license' | 'avatar'
export type UploadContentType = 'image/jpeg' | 'image/png' | 'application/pdf'

/**
 * Two-step GCS upload: signed URL from the backend, then a direct PUT.
 * Returns the object key to reference in later API calls (e.g. register).
 */
export async function uploadFile(purpose: UploadPurpose, file: File): Promise<string> {
  const contentType = file.type as UploadContentType
  const { key, url } = await api<{ key: string; url: string }>('/storage/upload-url', {
    method: 'POST',
    body: { purpose, contentType },
  })

  const put = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: file,
  })
  if (!put.ok) throw new Error(`Upload failed (${put.status})`)

  return key
}
