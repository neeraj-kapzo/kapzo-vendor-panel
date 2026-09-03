'use client'

import { useEffect, useState } from 'react'
import { InventoryClient } from './InventoryClient'
import type { MergedInventoryItem } from './InventoryClient'
import { useRequireVendor } from '@/lib/hooks/useRequireVendor'
import { fetchInventory } from '@/lib/api'
import { Skeleton, SkeletonRow } from '@/components/ui/Skeleton'
import { isDemoMode, DEMO_VENDOR_ID, DEMO_INVENTORY } from '@/lib/demo'

const PAGE_SIZE = 20
const MAX_PAGES = 50 // safety cap: 1000 catalog items

/**
 * The backend serves the catalog paginated; the inventory UI works on the
 * full merged list (client-side search/filter), so pull all pages up-front.
 */
async function fetchFullInventory(): Promise<MergedInventoryItem[]> {
  const items: MergedInventoryItem[] = []
  for (let page = 1; page <= MAX_PAGES; page++) {
    const result = await fetchInventory(undefined, page)
    items.push(
      ...result.items.map((row) => ({
        catalog_id:   row.catalogItem.id,
        name:         row.catalogItem.name,
        salt_name:    row.catalogItem.saltComposition || null,
        image_url:    row.catalogItem.imageUrl,
        mrp:          Number(row.catalogItem.mrp),
        // The list endpoint doesn't expose the VendorInventory row id; the
        // client only uses inv_id as a "row exists" hint, so the catalog id
        // stands in once a row is known to exist.
        inv_id:       row.price !== null ? row.catalogItem.id : null,
        vendor_price: row.price !== null ? Number(row.price) : Number(row.catalogItem.mrp),
        stock_qty:    0, // backend tracks availability only, no stock counts
        is_available: row.isAvailable,
      }))
    )
    if (page * PAGE_SIZE >= result.total) break
  }
  return items
}

export default function InventoryPage() {
  const { vendor, loading: vendorLoading } = useRequireVendor()
  const [items, setItems] = useState<MergedInventoryItem[] | null>(null)

  useEffect(() => {
    if (isDemoMode || !vendor) return
    let cancelled = false
    fetchFullInventory()
      .then((result) => {
        if (!cancelled) setItems(result)
      })
      .catch(() => {
        if (!cancelled) setItems([])
      })
    return () => {
      cancelled = true
    }
  }, [vendor])

  /* ── Demo mode ── */
  if (isDemoMode) {
    return (
      <InventoryClient
        vendorId={DEMO_VENDOR_ID}
        initialItems={DEMO_INVENTORY as MergedInventoryItem[]}
      />
    )
  }

  if (vendorLoading || !vendor || !items) {
    return (
      <div className="space-y-5 max-w-6xl mx-auto">
        <Skeleton className="h-10 w-56 rounded-xl" />
        <Skeleton className="h-10 w-full rounded-xl" />
        <div className="bg-white rounded-2xl border border-slate-100">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <SkeletonRow key={i} />
          ))}
        </div>
      </div>
    )
  }

  return <InventoryClient vendorId={vendor.id} initialItems={items} />
}
