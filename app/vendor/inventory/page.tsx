'use client'

import { InventoryClient } from './InventoryClient'
import type { MergedInventoryItem } from './InventoryClient'
import { useRequireVendor } from '@/lib/hooks/useRequireVendor'
import { Skeleton, SkeletonRow } from '@/components/ui/Skeleton'
import { isDemoMode, DEMO_VENDOR_ID, DEMO_INVENTORY } from '@/lib/demo'

export default function InventoryPage() {
  const { vendor, loading: vendorLoading } = useRequireVendor()

  /* ── Demo mode ── */
  if (isDemoMode) {
    return (
      <InventoryClient
        vendorId={DEMO_VENDOR_ID}
        demoItems={DEMO_INVENTORY as MergedInventoryItem[]}
      />
    )
  }

  if (vendorLoading || !vendor) {
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

  /* Search + pagination are client-driven, one backend page at a time —
     see InventoryClient. */
  return <InventoryClient vendorId={vendor.id} />
}
