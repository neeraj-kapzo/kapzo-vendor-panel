'use client'

import { useEffect, useMemo, useState } from 'react'
import { OrdersClient } from './OrdersClient'
import type { OrderWithItems } from './OrdersClient'
import { useRequireVendor } from '@/lib/hooks/useRequireVendor'
import { fetchActiveOrders, fetchClosedOrders } from '@/lib/api'
import { Skeleton } from '@/components/ui/Skeleton'
import { isDemoMode, DEMO_VENDOR_ID, getDemoActiveOrders, getDemoClosedOrders } from '@/lib/demo'

interface OrdersData {
  active: OrderWithItems[]
  closed: OrderWithItems[]
}

export default function OrdersPage() {
  const { vendor, loading: vendorLoading } = useRequireVendor()
  const [data, setData] = useState<OrdersData | null>(null)

  // Stable demo props — fresh arrays each render would re-seed state forever
  const demoData = useMemo(
    () =>
      isDemoMode
        ? {
            active: getDemoActiveOrders() as unknown as OrderWithItems[],
            closed: getDemoClosedOrders(),
          }
        : null,
    [],
  )

  useEffect(() => {
    if (isDemoMode || !vendor) return
    let cancelled = false
    Promise.all([fetchActiveOrders(vendor.id), fetchClosedOrders(vendor.id)])
      .then(([active, closed]) => {
        if (!cancelled) setData({ active, closed })
      })
      .catch(() => {
        if (!cancelled) setData({ active: [], closed: [] })
      })
    return () => {
      cancelled = true
    }
  }, [vendor])

  /* ── Demo mode ── */
  if (isDemoMode && demoData) {
    return (
      <OrdersClient
        vendorId={DEMO_VENDOR_ID}
        initialActive={demoData.active}
        initialClosed={demoData.closed}
      />
    )
  }

  if (vendorLoading || !vendor || !data) {
    return (
      <div className="space-y-5 max-w-4xl mx-auto">
        <Skeleton className="h-10 w-48 rounded-xl" />
        <Skeleton className="h-9 w-64 rounded-xl" />
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-2xl" />
        ))}
      </div>
    )
  }

  return (
    <OrdersClient vendorId={vendor.id} initialActive={data.active} initialClosed={data.closed} />
  )
}
