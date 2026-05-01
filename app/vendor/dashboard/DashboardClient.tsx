'use client'

import { useEffect, useState, useCallback } from 'react'
import { ShoppingBag, IndianRupee, Clock, TrendingUp, FlaskConical } from 'lucide-react'
import { StatsCard } from '@/components/vendor/StatsCard'
import { OrderFeedCard } from '@/components/vendor/OrderFeedCard'
import { OnlineToggle } from '@/components/vendor/OnlineToggle'
import { NewOrderToastContainer } from '@/components/vendor/NewOrderToast'
import { useVendorStore } from '@/lib/store/vendorStore'
import { useOrders } from '@/lib/hooks/useOrders'
import { createClient } from '@/lib/supabase/client'
import { isDemoMode, generateDemoSimulatedOrder } from '@/lib/demo'
import { useDemoStore } from '@/lib/demo/demoStore'
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

interface NewOrderAlert {
  id: string
  order: Order
}

interface DashboardClientProps {
  vendor: Vendor
  initialStats: Stats
  initialOrders: Order[]
}

/* ── Web Audio beep — no external files ── */
function playAlertBeep() {
  try {
    const ctx = new AudioContext()
    const t = ctx.currentTime

    function beep(freq: number, start: number, duration: number) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = freq
      osc.type = 'sine'
      gain.gain.setValueAtTime(0.45, t + start)
      gain.gain.exponentialRampToValueAtTime(0.001, t + start + duration)
      osc.start(t + start)
      osc.stop(t + start + duration)
    }

    beep(880, 0, 0.35)
    beep(1100, 0.4, 0.35)
    beep(880, 0.8, 0.35)
  } catch {
    /* AudioContext not available (SSR / old browser) — silent fail */
  }
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
  const [alerts, setAlerts]           = useState<NewOrderAlert[]>([])

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
    const supabase     = createClient()
    const todayStart   = new Date(); todayStart.setHours(0, 0, 0, 0)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1_000)

    const [
      { data: todayRows },
      { data: pendingRows },
      { data: weekRows },
    ] = await Promise.all([
      supabase.from('orders').select('id, status, total_amount')
        .eq('vendor_id', vendor.id).gte('created_at', todayStart.toISOString()),
      supabase.from('orders').select('id, status')
        .eq('vendor_id', vendor.id)
        .in('status', ['pending', 'accepted', 'packing']),
      supabase.from('orders').select('id, status')
        .eq('vendor_id', vendor.id).gte('created_at', sevenDaysAgo.toISOString()),
    ])

    const today   = todayRows  ?? []
    const pending = pendingRows ?? []
    const week    = weekRows   ?? []
    const total7    = week.length
    const accepted7 = week.filter((o) => !['rejected', 'cancelled'].includes(o.status)).length

    setStats({
      todayCount:     today.length,
      todayRevenue:   today.filter((o) => o.status === 'delivered').reduce((s, o) => s + o.total_amount, 0),
      pendingCount:   pending.length,
      acceptanceRate: total7 > 0 ? Math.round((accepted7 / total7) * 100) : 100,
    })
    setStatsLoading(false)
  }, [vendor.id])

  useEffect(() => {
    if (isDemoMode) return
    const id = setInterval(refreshStats, 30_000)
    return () => clearInterval(id)
  }, [refreshStats])

  /* ── Incoming order alert subscription (INSERT only) — skip in demo mode ── */
  useEffect(() => {
    if (isDemoMode) return

    const supabase = createClient()
    let titleInterval: ReturnType<typeof setInterval> | null = null

    function flashTitle() {
      if (titleInterval) return
      const original = document.title
      let on = true
      titleInterval = setInterval(() => {
        document.title = on ? '\uD83D\uDD14 New Order!' : 'Kapzo Vendor'
        on = !on
      }, 1_000)
      setTimeout(() => {
        if (titleInterval) clearInterval(titleInterval)
        titleInterval = null
        document.title = original
      }, 10_000)
    }

    const channel = supabase
      .channel('dashboard-new-orders')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders',
          filter: `vendor_id=eq.${vendor.id}`,
        },
        (payload) => {
          const order = payload.new as Order
          setAlerts((prev) => [...prev, { id: order.id, order }])
          playAlertBeep()
          flashTitle()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
      if (titleInterval) clearInterval(titleInterval)
    }
  }, [vendor.id])

  function dismissAlert(id: string) {
    setAlerts((prev) => prev.filter((a) => a.id !== id))
  }

  /* ── Demo: simulate a new incoming order ── */
  function simulateNewOrder() {
    const order = generateDemoSimulatedOrder()

    // Add to demo store so OrdersClient can pick it up
    addSimulatedOrder(order)

    // Trigger the notification UI on this page
    setAlerts((prev) => [...prev, { id: order.id, order: order as unknown as Order }])
    playAlertBeep()

    // Flash tab title for 8 seconds
    const original = document.title
    let on = true
    const interval = setInterval(() => {
      document.title = on ? '🔔 New Order!' : 'Kapzo Vendor'
      on = !on
    }, 1_000)
    setTimeout(() => {
      clearInterval(interval)
      document.title = original
    }, 8_000)
  }

  return (
    <>
      {/* Sliding toast alerts — fixed top-right, outside normal flow */}
      <NewOrderToastContainer alerts={alerts} onDismiss={dismissAlert} />

      <div className="space-y-6 max-w-7xl mx-auto">

        {/* ── Page header ── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-[#022135]">
              Good {getGreeting()},{' '}
              <span className="kapzo-gradient-text">{vendor.contact_person.split(' ')[0]}</span>
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
