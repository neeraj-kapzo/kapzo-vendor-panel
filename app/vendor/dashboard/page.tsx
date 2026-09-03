'use client'

import { useEffect, useMemo, useState } from 'react'
import { DashboardClient } from './DashboardClient'
import { useRequireVendor } from '@/lib/hooks/useRequireVendor'
import { fetchDashboardStats, type DashboardStats } from '@/lib/api'
import { Skeleton } from '@/components/ui/Skeleton'
import { isDemoMode, DEMO_VENDOR, getDemoActiveOrders, getDemoStats } from '@/lib/demo'
import type { Order } from '@/types/database.types'

interface InitialData {
  stats: DashboardStats
  orders: Order[]
}

export default function DashboardPage() {
  const { vendor, loading: vendorLoading } = useRequireVendor()
  const [data, setData] = useState<InitialData | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Demo data must be referentially stable across renders — fresh arrays every
  // render would re-trigger the client's store-seeding effect forever.
  const demoData = useMemo(
    () => (isDemoMode ? { stats: getDemoStats(), orders: getDemoActiveOrders() } : null),
    [],
  )

  useEffect(() => {
    if (isDemoMode || !vendor) return
    let cancelled = false
    fetchDashboardStats(vendor.id)
      .then(({ activeOrders, ...stats }) => {
        if (!cancelled) setData({ stats, orders: activeOrders })
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message)
      })
    return () => {
      cancelled = true
    }
  }, [vendor])

  /* ── Demo mode — bypass the backend entirely ── */
  if (isDemoMode && demoData) {
    const { todayCount, todayRevenue, pendingCount, acceptanceRate } = demoData.stats
    return (
      <DashboardClient
        vendor={DEMO_VENDOR}
        initialStats={{ todayCount, todayRevenue, pendingCount, acceptanceRate }}
        initialOrders={demoData.orders}
      />
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
        <div className="w-14 h-14 rounded-2xl bg-[#21A053]/10 flex items-center justify-center text-2xl">🏥</div>
        <div>
          <h2 className="text-lg font-bold text-[#022135]">Could not load your dashboard</h2>
          <p className="text-sm text-slate-500 mt-1 max-w-xs">
            Check your connection and refresh. If this keeps happening, contact Kapzo support.
          </p>
          <p className="text-xs text-red-400 mt-2 font-mono">{error}</p>
        </div>
      </div>
    )
  }

  if (vendorLoading || !vendor || !data) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto">
        <Skeleton className="h-16 w-full rounded-2xl" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    )
  }

  return (
    <DashboardClient vendor={vendor} initialStats={data.stats} initialOrders={data.orders} />
  )
}
