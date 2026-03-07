'use client'

import { useEffect, useRef } from 'react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import { useVendorStore } from '@/lib/store/vendorStore'
import type { Order } from '@/types/database.types'

/* ─── Audio alert (Web Audio API — no files needed) ─── */
function playAlertBeep() {
  try {
    const ctx = new AudioContext()
    const freqs = [880, 1100, 880]
    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.value = freq
      const t = ctx.currentTime + i * 0.18
      gain.gain.setValueAtTime(0.4, t)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15)
      osc.start(t)
      osc.stop(t + 0.15)
    })
  } catch {
    // Autoplay policy blocked — silent fail
  }
}

/* ─── Tab title flash ─── */
function flashTitle(intervalRef: React.MutableRefObject<ReturnType<typeof setInterval> | null>) {
  if (intervalRef.current) return // already flashing
  const orig = document.title
  let on = false
  intervalRef.current = setInterval(() => {
    document.title = on ? orig : '🔔 New Order!'
    on = !on
  }, 800)
  setTimeout(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    intervalRef.current = null
    document.title = orig
  }, 8000)
}

export function useRealtimeOrders(vendorId: string | undefined) {
  const { addPendingOrder, updateOrderStatus, setActiveOrders } = useVendorStore()
  const flashIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  /* ── Initial fetch ── */
  useEffect(() => {
    if (!vendorId) return
    const supabase = createClient()
    supabase
      .from('orders')
      .select('*')
      .eq('vendor_id', vendorId)
      .in('status', ['pending', 'accepted', 'packing', 'packed', 'dispatched'])
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) setActiveOrders(data as Order[])
      })
  }, [vendorId, setActiveOrders])

  /* ── Realtime subscription ── */
  useEffect(() => {
    if (!vendorId) return
    const supabase = createClient()

    const channel = supabase
      .channel(`realtime-orders-${vendorId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders',
          filter: `vendor_id=eq.${vendorId}`,
        },
        async (payload) => {
          const order = payload.new as Order

          // Fetch full record to confirm it's still pending
          const { data } = await supabase
            .from('orders')
            .select('*')
            .eq('id', order.id)
            .single()

          if (!data || data.status !== 'pending') return

          addPendingOrder(data as Order)
          playAlertBeep()
          flashTitle(flashIntervalRef)
          toast.custom(
            (t) => (
              <div
                className={`flex items-center gap-3 rounded-xl px-4 py-3 shadow-lg transition-all
                  bg-white border border-green-200 ${t.visible ? 'opacity-100' : 'opacity-0'}`}
              >
                <span className="text-xl">🛒</span>
                <div>
                  <p className="font-semibold text-[#022135] text-sm">New Order!</p>
                  <p className="text-xs text-gray-500">₹{data.total_amount} · Accept within 2 min</p>
                </div>
              </div>
            ),
            { duration: 6000 }
          )
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `vendor_id=eq.${vendorId}`,
        },
        (payload) => {
          const order = payload.new as Order
          updateOrderStatus(order.id, order.status)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
      if (flashIntervalRef.current) {
        clearInterval(flashIntervalRef.current)
        flashIntervalRef.current = null
      }
    }
  }, [vendorId, addPendingOrder, updateOrderStatus])
}
