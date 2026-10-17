'use client'

import { useEffect, useState, useCallback } from 'react'
import { ShoppingBag, IndianRupee, Clock, TrendingUp, FlaskConical } from 'lucide-react'
import { StatsCard } from '@/components/vendor/StatsCard'
import { OrderFeedCard } from '@/components/vendor/OrderFeedCard'
import { OnlineToggle } from '@/components/vendor/OnlineToggle'
import { useVendorStore } from '@/lib/store/vendorStore'
import { useOrders } from '@/lib/hooks/useOrders'
import { fetchDashboardStats } from '@/lib/api'
import { useOnSimulationReset } from '@/lib/hooks/useSimulationReset'
import { isDemoMode, generateDemoSimulatedOrder } from '@/lib/demo'
import { useDemoStore } from '@/lib/demo/demoStore'
import { DEMO_NEW_ORDER_EVENT } from '@/lib/hooks/useNewOrderAlerts'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { formatCurrency } from '@/lib/utils'
import type { Vendor, Order } from '@/types/database.types'

interface Stats {
  todayCount: number
  todayRevenue: number
  pendingCount: number
  acceptanceRate: number
}

interface DashboardClientProps {
  vendor: Vendor
  initialStats: Stats
  initialOrders: Order[]
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}

export function DashboardClient({ vendor, initialStats, initialOrders }: DashboardClientProps) {
  const { setVendor, setActiveOrders, activeOrders } = useVendorStore()
  const [stats, setStats]             = useState<Stats>(initialStats)
  const [statsLoading, setStatsLoading] = useState(false)

  /* ── Demo store (noop when not in demo mode) ── */
  const { addSimulatedOrder } = useDemoStore()

  /* ── Seed zustand store from server props ── */
  useEffect(() => {
    setVendor(vendor)
    setActiveOrders(initialOrders)
  }, [vendor, initialOrders, setVendor, setActiveOrders])

  /* ── Live orders feed + realtime (handled by hook, synced to store) ── */
  useOrders(vendor.id)

  /* ── Stats refresh every 30 s — skip in demo mode ── */
  const refreshStats = useCallback(async () => {
    if (isDemoMode) return
    setStatsLoading(true)
    try {
      const { activeOrders: _orders, ...next } = await fetchDashboardStats(vendor.id)
      void _orders
      setStats(next)
    } catch {
      /* transient failure — keep last known stats */
    }
    setStatsLoading(false)
  }, [vendor.id])

  useEffect(() => {
    if (isDemoMode) return
    const id = setInterval(refreshStats, 30_000)
    return () => clearInterval(id)
  }, [refreshStats])

  /* ── Admin wiped the simulated orders: drop their alerts, refresh counts.
       The shell already removed them from the store (useOrders refetches). ── */
  const onSimulationReset = useCallback(() => {
    void refreshStats()
  }, [refreshStats])
  useOnSimulationReset(onSimulationReset)

  /* ── Demo: simulate a new incoming order ── */
  function simulateNewOrder() {
    const order = generateDemoSimulatedOrder()

    // Add to demo store so OrdersClient can pick it up
    addSimulatedOrder(order)

    // Shell-level alert (beep + tab flash + toast) fires on every page
    window.dispatchEvent(new CustomEvent(DEMO_NEW_ORDER_EVENT, { detail: order }))
  }

  return (
    <>
      <div className="space-y-6 max-w-7xl mx-auto">

        {/* ── Page header ── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-[#022135]">
              Good {getGreeting()},{' '}
              <span className="kapzo-gradient-text">
                {(vendor.contact_person || vendor.pharmacy_name).split(' ')[0]}
              </span>
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Here&apos;s what&apos;s happening at <strong className="text-[#022135] font-semibold">{vendor.pharmacy_name}</strong> today.
            </p>
          </div>

          {/* Demo simulate button */}
          {isDemoMode && (
            <button
              onClick={simulateNewOrder}
              className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:opacity-90 active:scale-[0.98] transition-all shadow-[0_2px_12px_rgba(245,158,11,0.35)]"
            >
              <FlaskConical size={15} />
              Simulate New Order
            </button>
          )}
        </div>

        {/* ── Online / Offline toggle (prominent V-02) ── */}
        <OnlineToggle variant="prominent" />

        {/* ── Stats grid ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard
            title="Orders Today"
            value={stats.todayCount}
            icon={ShoppingBag}
            accentColor="green"
            loading={statsLoading}
          />
          <StatsCard
            title="Pending Orders"
            value={stats.pendingCount}
            subtitle="Awaiting action"
            icon={Clock}
            accentColor="amber"
            loading={statsLoading}
          />
          <StatsCard
            title="Today's Revenue"
            value={formatCurrency(stats.todayRevenue)}
            icon={IndianRupee}
            accentColor="navy"
            loading={statsLoading}
          />
          <StatsCard
            title="Acceptance Rate"
            value={`${stats.acceptanceRate}%`}
            subtitle="Last 7 days"
            icon={TrendingUp}
            accentColor="green"
            loading={statsLoading}
          />
        </div>

        {/* ── Active orders feed ── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-base font-semibold text-[#022135]">Active Orders</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {isDemoMode ? 'Simulated data' : 'Updates in real-time'}
              </p>
            </div>
            <Link href="/vendor/orders">
              <Button variant="ghost" size="sm" className="text-[#21A053] font-semibold">
                Manage all &rarr;
              </Button>
            </Link>
          </div>

          {activeOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 bg-white rounded-2xl border border-slate-100 shadow-sm">
              <div className="w-14 h-14 rounded-2xl bg-[#21A053]/8 flex items-center justify-center mb-4">
                <ShoppingBag size={26} className="text-[#21A053]/50" />
              </div>
              <p className="text-sm font-semibold text-slate-500">No active orders right now</p>
              <p className="text-xs text-slate-400 mt-1">New orders will appear here instantly</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {activeOrders.map((order) => (
                <OrderFeedCard key={order.id} order={order} />
              ))}
            </div>
          )}
        </div>

      </div>
    </>
  )
}
