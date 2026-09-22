import type {
  CatalogItem,
  Order,
  OrderItem,
  OrderStatus,
  OrderWithItems,
  Vendor,
  VendorStatus,
} from '@/types/database.types'
import type {
  BackendOrderStatus,
  BackendVendor,
  BackendVendorOrder,
  BackendVerificationStatus,
} from './types'

export function mapOrderStatus(status: BackendOrderStatus): OrderStatus {
  return status.toLowerCase() as OrderStatus
}

export function mapVendorStatus(status: BackendVerificationStatus): VendorStatus {
  return status.toLowerCase() as VendorStatus
}

/**
 * Backend Vendor → UI Vendor. `/vendors/me` carries the owner's name/email and
 * signed document URLs alongside the Vendor row, so everything the profile
 * page renders comes from one call. `fallbackEmail` (the Firebase user's
 * email) only fills in when the backend has none on the User row.
 */
export function mapVendor(v: BackendVendor, fallbackEmail?: string | null): Vendor {
  return {
    id: v.id,
    user_id: v.userId,
    pharmacy_name: v.pharmacyName,
    email: v.email ?? fallbackEmail ?? '',
    phone: v.contactPhone,
    alt_phone: v.altPhone,
    license_url: v.licenseUrl,
    fssai_url: v.fssaiUrl,
    license_number: v.licenseNumber,
    contact_person: v.contactPerson ?? '',
    address: v.addressLine,
    bank_account_holder: v.bankAccountHolder,
    bank_name: v.bankName,
    bank_account_number: v.bankAccountNumber,
    bank_ifsc: v.bankIfsc,
    working_hours_start: v.workingHoursStart,
    working_hours_end: v.workingHoursEnd,
    working_days: v.workingDays,
    status: mapVendorStatus(v.verificationStatus),
    is_online: v.isOnline,
    created_at: '',
    commission_percent: Number(v.commissionPercent),
    license_file_key: v.licenseFileKey,
    lat: v.lat,
    lng: v.lng,
  }
}

/**
 * Backend vendor order row → UI OrderWithItems. Item name/price snapshots
 * live on the OrderItem itself in the backend, so the synthesised
 * `catalog_item` carries the snapshot name (image/salt unknown → null).
 */
export function mapVendorOrder(o: BackendVendorOrder, vendorId: string): OrderWithItems {
  const order_items: (OrderItem & { catalog_item: CatalogItem })[] = (o.items ?? []).map(
    (item) => ({
      id: item.id,
      order_id: item.orderId,
      catalog_item_id: item.catalogItemId,
      quantity: item.quantity,
      unit_price: Number(item.price),
      catalog_item: {
        id: item.catalogItemId,
        name: item.name,
        salt_name: null,
        image_url: null,
        mrp: Number(item.price),
        created_by_admin: true,
      },
    }),
  )

  return {
    id: o.id,
    vendor_id: vendorId,
    customer_id: '',
    rider_id: null,
    status: mapOrderStatus(o.status),
    total_amount: Number(o.total),
    created_at: o.createdAt,
    updated_at: o.createdAt,
    rejection_reason: o.rejectionReason,
    prescription_verified: false,
    prescription_url: null,
    order_number: o.orderNumber,
    customer_name: o.customerName ?? null,
    address_line: o.addressLine,
    subtotal: Number(o.subtotal),
    delivery_fee: Number(o.deliveryFee),
    platform_fee: Number(o.platformFee),
    commission_amount: Number(o.commissionAmount),
    expires_at: o.expiresAt,
    seconds_left: o.secondsLeft ?? null,
    is_simulated: o.isSimulated ?? false,
    order_items,
  }
}

export function mapVendorOrders(rows: BackendVendorOrder[], vendorId: string): OrderWithItems[] {
  return rows.map((row) => mapVendorOrder(row, vendorId))
}

/** Plain Order view (no items) for feeds that don't need line items. */
export function mapVendorOrderPlain(o: BackendVendorOrder, vendorId: string): Order {
  const { order_items: _items, ...order } = mapVendorOrder(o, vendorId)
  void _items
  return order
}
