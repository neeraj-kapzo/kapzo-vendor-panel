'use client'

import { HistoryClient } from './HistoryClient'
import { useRequireVendor } from '@/lib/hooks/useRequireVendor'
import { Skeleton } from '@/components/ui/Skeleton'
import { isDemoMode, DEMO_VENDOR_ID } from '@/lib/demo'

export default function HistoryPage() {
  const { vendor, loading } = useRequireVendor()

  /* ── Demo mode ── */
  if (isDemoMode) {
    return <HistoryClient vendorId={DEMO_VENDOR_ID} />
  }

  if (loading || !vendor) {
    return (
      <div className="space-y-5 max-w-5xl mx-auto">
        <Skeleton className="h-10 w-48 rounded-xl" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    )
  }

  /* All data fetching is client-driven (date filters + pagination) */
  return <HistoryClient vendorId={vendor.id} />
}
