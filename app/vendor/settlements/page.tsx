'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { SettlementsClient } from './SettlementsClient'
import { useRequireVendor } from '@/lib/hooks/useRequireVendor'
import { fetchVendorStats, type BackendVendorStats } from '@/lib/api'
import { SIMULATION_RESET_EVENT } from '@/lib/hooks/useSimulationReset'
import { Skeleton } from '@/components/ui/Skeleton'
import {
  isDemoMode, DEMO_VENDOR_ID, DEMO_SETTLEMENTS,
  getDemoSettlementStats,
} from '@/lib/demo'

export default function SettlementsPage() {
  const { vendor, loading: vendorLoading } = useRequireVendor()
  const [stats, setStats] = useState<BackendVendorStats | null>(null)
  // "Latest request wins" — see the identical comment in inventory/page.tsx
  // for why this isn't a one-shot "already started" guard.
  const fetchIdRef = useRef(0)

  // Stable demo stats — recomputing every render would re-seed client state
  const demoStats = useMemo(() => (isDemoMode ? getDemoSettlementStats() : null), [])

  const load = useCallback(() => {
    if (isDemoMode || !vendor) return
    const fetchId = ++fetchIdRef.current
    // Phase 1: payouts are settled offline, so there is no settlement ledger
    // yet — the pending balance is the last 30 days' earnings from the
    // backend stats endpoint (gross sales minus Kapzo commission).
    fetchVendorStats('month')
      .then((s) => {
        if (fetchIdRef.current === fetchId) setStats(s)
      })
      .catch(() => {
        if (fetchIdRef.current === fetchId) {
          setStats({ deliveredCount: 0, grossSales: 0, commission: 0, earnings: 0 })
        }
      })
  }, [vendor])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const onReset = () => load()
    window.addEventListener(SIMULATION_RESET_EVENT, onReset)
    return () => window.removeEventListener(SIMULATION_RESET_EVENT, onReset)
  }, [load])

  /* ── Demo mode ── */
  if (isDemoMode && demoStats) {
    const stats = demoStats
    return (
      <SettlementsClient
        vendorId={DEMO_VENDOR_ID}
        initialSettlements={DEMO_SETTLEMENTS}
        totalSettled={stats.totalSettled}
        pendingAmount={stats.pendingAmount}
        completedCount={stats.completedCount}
        failedCount={stats.failedCount}
        lastStatus={stats.lastStatus}
      />
    )
  }

  if (vendorLoading || !vendor || stats === null) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-56 rounded-xl" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-72 w-full rounded-2xl" />
      </div>
    )
  }

  return (
    <SettlementsClient
      key={stats.earnings}
      vendorId={vendor.id}
      initialSettlements={[]}
      totalSettled={0}
      pendingAmount={stats.earnings}
      earnings={stats}
      completedCount={0}
      failedCount={0}
      lastStatus="pending"
    />
  )
}
